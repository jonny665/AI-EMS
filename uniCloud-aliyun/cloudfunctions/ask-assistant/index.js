"use strict";

const db = uniCloud.database();
const HISTORY_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (!["student", "teacher", "admin"].includes(session.role) || !session.userId) {
    return { ok: false, message: "Login is required." };
  }

  const query = String(event.query || event.question || "").trim();
  if (!query) {
    return { ok: false, message: "Question is required." };
  }

  const startedAt = Date.now();
  await purgeExpiredAiHistory(startedAt, event);
  const conversation = await resolveConversation(session, event, query, startedAt);
  const historyUserText = Array.isArray(event.history)
    ? event.history
        .slice(-10)
        .filter((item) => item && item.role === "user")
        .map((item) => item.content)
        .filter(Boolean)
        .join(" ")
    : "";
  const keywords = buildQueryKeywords(query);
  const contextKeywords = buildQueryKeywords(historyUserText);
  const rows = await readKnowledgeBase();
  const hit = findBestMatch(rows, query, keywords, contextKeywords);
  const latencyMs = Date.now() - startedAt;
  const answer = hit
    ? hit.content || ""
    : "The current knowledge base does not have enough information. Please contact academic staff for confirmation.";
  const fallbackUsed = !hit;

  await writeMessage(conversation._id, {
    role: "user",
    content: query,
    fallback_used: false,
    citations: [],
    latency_ms: 0,
    created_at: startedAt,
  });
  await writeMessage(conversation._id, {
    role: "assistant",
    content: answer,
    model: "local-keyword-kb",
    citations: hit ? [{ knowledge_base_id: hit._id, title: hit.title || "" }] : [],
    fallback_used: fallbackUsed,
    latency_ms: latencyMs,
    created_at: Date.now(),
  });
  await updateConversation(conversation, query, startedAt);

  await writeAudit("ask_assistant", session, {
    query,
    grounded: Boolean(hit),
    source_id: hit ? hit._id : "",
    context_turns: Array.isArray(event.history) ? Math.min(event.history.length, 5) : 0,
    conversation_id: conversation._id,
    latency_ms: latencyMs,
  });

  if (!hit) {
    return {
      ok: true,
      data: {
        answer,
        source: "",
        sourceTitle: "",
        grounded: false,
        fallbackUsed,
        conversationId: conversation._id,
      },
    };
  }

  return {
    ok: true,
    data: {
      answer,
      source: hit.title || "",
      sourceTitle: hit.title || "",
      grounded: true,
      fallbackUsed,
      knowledgeBaseId: hit._id,
      conversationId: conversation._id,
    },
  };
};

async function resolveConversation(session, event, query, now) {
  const requestedId = String(event.conversationId || "").trim();
  if (requestedId) {
    const existing = await findConversationById(requestedId);
    if (existing && existing.user_id === session.userId) {
      return existing;
    }
  }

  const scenario = resolveScenario(query);
  const active = await findActiveConversation(session.userId, scenario);
  if (active) {
    return active;
  }

  const conversation = {
    user_id: session.userId,
    title: query.slice(0, 40) || "AI Assistant Conversation",
    scenario,
    context_summary: "",
    message_count: 0,
    status: "active",
    created_at: now,
    updated_at: now,
  };
  const result = await db.collection("ai_conversations").add(conversation);
  return { ...conversation, _id: result.id };
}

async function findConversationById(id) {
  try {
    const result = await db.collection("ai_conversations").doc(id).get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    console.warn("[ask-assistant] conversation lookup skipped.", error);
    return null;
  }
}

async function findActiveConversation(userId, scenario) {
  try {
    const result = await db
      .collection("ai_conversations")
      .where({ user_id: userId, scenario, status: "active" })
      .limit(1)
      .get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    console.warn("[ask-assistant] active conversation lookup skipped.", error);
    return null;
  }
}

async function writeMessage(conversationId, message) {
  try {
    await db.collection("ai_messages").add({
      conversation_id: conversationId,
      ...message,
    });
  } catch (error) {
    console.warn("[ask-assistant] ai message write skipped.", error);
  }
}

async function updateConversation(conversation, query, now) {
  try {
    await db.collection("ai_conversations").doc(conversation._id).update({
      title: conversation.title || query.slice(0, 40) || "AI Assistant Conversation",
      context_summary: query.slice(0, 120),
      message_count: Number(conversation.message_count || 0) + 2,
      updated_at: now,
    });
  } catch (error) {
    console.warn("[ask-assistant] conversation update skipped.", error);
  }
}

async function purgeExpiredAiHistory(now = Date.now(), event = {}) {
  if (event.skipRetentionCleanup === true) {
    return;
  }
  if (Math.random() >= 0.02) {
    return;
  }
  const cutoff = now - HISTORY_RETENTION_MS;
  await removeOldRows("ai_messages", "created_at", cutoff);
  await removeOldRows("ai_conversations", "updated_at", cutoff);
}

async function removeOldRows(collection, field, cutoff) {
  try {
    const result = await db.collection(collection).limit(500).get();
    const rows = (result.data || []).filter((item) => Number(item[field] || 0) < cutoff);
    for (const row of rows) {
      if (row._id) {
        await db.collection(collection).doc(row._id).remove();
      }
    }
  } catch (error) {
    console.warn(`[ask-assistant] ${collection} retention cleanup skipped.`, error);
  }
}

function resolveScenario(query) {
  const value = String(query || "").toLowerCase();
  if (/(course|selection|elective|课程|选课)/.test(value)) return "course_selection";
  if (/(schedule|timetable|课表|安排)/.test(value)) return "schedule_query";
  if (/(exam|考试)/.test(value)) return "exam_query";
  if (/(graduation|credit|毕业|学分)/.test(value)) return "graduation_check";
  if (/(policy|rule|制度|政策)/.test(value)) return "policy_qa";
  return "other";
}

async function readKnowledgeBase() {
  try {
    const result = await db.collection("knowledge_base").limit(300).get();
    return result.data || [];
  } catch (error) {
    console.warn("[ask-assistant] knowledge_base read failed.", error);
    return [];
  }
}

function buildQueryKeywords(query) {
  const cleaned = query
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned ? cleaned.split(" ") : [];
  const cjkRuns = cleaned.replace(/[a-z0-9\s]/g, "");
  const cjkTokens = [];
  for (let i = 0; i < cjkRuns.length; i += 1) {
    cjkTokens.push(cjkRuns.slice(i, i + 1));
    if (i + 1 < cjkRuns.length) {
      cjkTokens.push(cjkRuns.slice(i, i + 2));
    }
    if (i + 2 < cjkRuns.length) {
      cjkTokens.push(cjkRuns.slice(i, i + 3));
    }
  }
  return Array.from(
    new Set(words.concat(cjkTokens).flatMap((word) => [word, singularize(word)]).filter(Boolean)),
  );
}

function findBestMatch(rows, query, keywords, contextKeywords = []) {
  const cleanedQuery = query.toLowerCase();
  const context = new Set(contextKeywords);
  const scored = rows
    .map((item) => {
      const itemKeywords = Array.isArray(item.keywords) ? item.keywords : [];
      const hitCount = itemKeywords.reduce((sum, keyword) => {
        const normalized = singularize(String(keyword || "").toLowerCase());
        const directHit = keywords.includes(normalized) || cleanedQuery.includes(normalized);
        const contextHit = context.has(normalized);
        if (directHit) {
          return sum + 3;
        }
        if (contextHit) {
          return sum + 1;
        }
        return sum;
      }, 0);
      const titleHit = item.title && cleanedQuery.includes(String(item.title).toLowerCase()) ? 2 : 0;
      return { ...item, _score: hitCount + titleHit };
    })
    .filter((item) => item._score > 0)
    .sort((a, b) => b._score - a._score);

  return scored[0] || null;
}

function singularize(value) {
  return String(value || "").replace(/s$/i, "");
}

async function writeAudit(action, session, data) {
  try {
    await db.collection("audit_logs").add({
      action,
      actor_user_id: session.userId,
      target_collection: "knowledge_base",
      after: data,
      created_at: Date.now(),
    });
  } catch (error) {
    console.warn("[ask-assistant] audit write skipped.", error);
  }
}
