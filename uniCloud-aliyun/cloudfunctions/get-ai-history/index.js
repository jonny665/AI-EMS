"use strict";

const db = uniCloud.database();
const HISTORY_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (!session.userId || !["student", "teacher", "admin"].includes(session.role)) {
    return { ok: false, message: "Login is required." };
  }

  await purgeExpiredAiHistory(Date.now(), event);

  const conversations = await readUserConversations(session.userId);
  const requestedId = String(event.conversationId || "").trim();
  const activeConversation =
    conversations.find((item) => item._id === requestedId) ||
    conversations[0] ||
    null;
  const messages = activeConversation ? await readMessages(activeConversation._id) : [];

  return {
    ok: true,
    data: {
      userId: session.userId,
      conversations: conversations.map(toConversationView),
      activeConversationId: activeConversation ? activeConversation._id : "",
      messages: messages.map(toMessageView),
      retentionDays: 60,
    },
  };
};

async function readUserConversations(userId) {
  try {
    const result = await db.collection("ai_conversations").where({ user_id: userId }).limit(20).get();
    return (result.data || []).sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));
  } catch (error) {
    console.warn("[get-ai-history] conversation read skipped.", error);
    return [];
  }
}

async function readMessages(conversationId) {
  try {
    const result = await db.collection("ai_messages").where({ conversation_id: conversationId }).limit(100).get();
    return (result.data || []).sort((a, b) => Number(a.created_at || 0) - Number(b.created_at || 0));
  } catch (error) {
    console.warn("[get-ai-history] message read skipped.", error);
    return [];
  }
}

function toConversationView(item) {
  return {
    _id: item._id,
    userId: item.user_id || "",
    title: item.title || "AI Assistant Conversation",
    scenario: item.scenario || "other",
    contextSummary: item.context_summary || "",
    messageCount: Number(item.message_count || 0),
    status: item.status || "active",
    createdAt: Number(item.created_at || 0),
    updatedAt: Number(item.updated_at || 0),
  };
}

function toMessageView(item) {
  return {
    _id: item._id,
    conversationId: item.conversation_id || "",
    role: item.role || "",
    content: item.content || "",
    model: item.model || "",
    citations: Array.isArray(item.citations) ? item.citations : [],
    fallbackUsed: item.fallback_used === true,
    latencyMs: Number(item.latency_ms || 0),
    createdAt: Number(item.created_at || 0),
  };
}

async function purgeExpiredAiHistory(now, event = {}) {
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
    console.warn(`[get-ai-history] ${collection} retention cleanup skipped.`, error);
  }
}
