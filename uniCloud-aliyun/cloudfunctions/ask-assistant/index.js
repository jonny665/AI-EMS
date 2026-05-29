"use strict";

const db = uniCloud.database();
const HISTORY_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const DEEPSEEK_MODEL = "deepseek-chat";
const DEEPSEEK_TIMEOUT = 30000;
const RAG_TOP_K = 3;

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
  await purgeExpiredAiHistory(startedAt);
  const conversation = await resolveConversation(session, event, query, startedAt);

  const keywords = buildQueryKeywords(query);
  const contextData = await enrichContext(session, query, keywords);
  const topHits = findTopMatches(contextData.knowledgeRows || [], query, keywords, RAG_TOP_K);

  const systemPrompt = buildSystemPrompt(topHits, contextData, session);
  const historyMessages = buildHistoryMessages(event.history);
  const messages = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user", content: query },
  ];

  const userSettings = event.apiSettings || {};
  const apiKey = userSettings.apiKey || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      message: "API key not configured. Set it in the AI Assistant settings or configure DEEPSEEK_API_KEY in the cloud function environment variables.",
    };
  }

  const provider = userSettings.provider || "deepseek";
  const baseUrl = provider === "openai"
    ? "https://api.openai.com/v1"
    : "https://api.deepseek.com/v1";
  const model = userSettings.model || DEEPSEEK_MODEL;
  const temperature = Number(userSettings.temperature ?? 0.7);
  const maxTokens = Number(userSettings.maxTokens ?? 2048);

  let answer;
  const citations = topHits.map((h) => ({ knowledge_base_id: h._id, title: h.title || "" }));

  try {
    const result = await uniCloud.httpclient.request(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        data: {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        },
        dataType: "json",
        timeout: DEEPSEEK_TIMEOUT,
      },
    );
    answer = result.data.choices[0].message.content;
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    await writeMessage(conversation._id, {
      role: "user",
      content: query,
      fallback_used: false,
      citations: [],
      latency_ms: 0,
      created_at: startedAt,
    });
    await writeAudit("ask_assistant", session, {
      query,
      grounded: false,
      source_id: "",
      context_turns: Array.isArray(event.history) ? Math.min(event.history.length, 5) : 0,
      conversation_id: conversation._id,
      latency_ms: latencyMs,
      error: String(error.message || error),
    });
    return {
      ok: false,
      message: `AI service error: ${error.message || "Unknown error"}. Please try again later.`,
    };
  }

  const latencyMs = Date.now() - startedAt;
  const grounded = topHits.length > 0;

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
    model,
    citations,
    fallback_used: false,
    latency_ms: latencyMs,
    created_at: Date.now(),
  });
  await updateConversation(conversation, query, startedAt);

  await writeAudit("ask_assistant", session, {
    query,
    grounded,
    source_id: grounded ? topHits[0]._id : "",
    context_turns: Array.isArray(event.history) ? Math.min(event.history.length, 5) : 0,
    conversation_id: conversation._id,
    latency_ms: latencyMs,
  });

  return {
    ok: true,
    data: {
      answer,
      source: grounded ? topHits[0].title || "" : "",
      sourceTitle: grounded ? topHits[0].title || "" : "",
      grounded,
      fallbackUsed: false,
      knowledgeBaseId: grounded ? topHits[0]._id : undefined,
      conversationId: conversation._id,
    },
  };
};

function buildSystemPrompt(topHits, contextData, session) {
  let prompt =
    "You are a helpful educational management assistant for a university. Answer questions accurately in Chinese. Be concise.";

  if (contextData) {
    if (session.role === "student" || session.role === "teacher") {
      prompt += `\n\nCurrent user: ${session.displayName || ""} (${session.role}, id: ${session.userId}).`;
    }
    if (contextData.userProfile) {
      prompt += `\n\nUser Profile:\n${contextData.userProfile}`;
    }
    if (contextData.courses && contextData.courses.length > 0) {
      prompt += `\n\nCourses (${contextData.courses.length}):\n${contextData.courses.map((c) => `- ${c.code} ${c.name} (${c.credits} credits, ${c.teacher || ""}, semester ${c.semester || ""})`).join("\n")}`;
    }
    if (contextData.attendance && contextData.attendance.length > 0) {
      prompt += `\n\nRecent Attendance (${contextData.attendance.length} records):\n${contextData.attendance.map((a) => `- ${a.date} ${a.courseName}: ${a.status}`).join("\n")}`;
    }
    if (contextData.leaves && contextData.leaves.length > 0) {
      prompt += `\n\nLeave Requests (${contextData.leaves.length}):\n${contextData.leaves.map((l) => `- ${l.date} ${l.courseName}: ${l.status} (${l.type})`).join("\n")}`;
    }
    if (contextData.grades) {
      prompt += `\n\nGPA / Grades:\n${contextData.grades}`;
    }
    if (contextData.evaluations && contextData.evaluations.length > 0) {
      prompt += `\n\nCourse Evaluations:\n${contextData.evaluations.map((e) => `- ${e.courseName}: avg ${e.avg}/5 (${e.count} responses), difficulty ${e.diffAvg}/5`).join("\n")}`;
    }
    if (contextData.teachers && contextData.teachers.length > 0) {
      prompt += `\n\nTeachers:\n${contextData.teachers.map((t) => `- ${t.name} (${t.title || ""}): ${t.department || ""}, ${t.fields || ""}`).join("\n")}`;
    }
    if (contextData.graduation) {
      prompt += `\n\nGraduation Progress:\n${contextData.graduation}`;
    }
    if (contextData.stats) {
      prompt += `\n\nSystem Stats:\n- Students: ${contextData.stats.students}\n- Teachers: ${contextData.stats.teachers}\n- Courses: ${contextData.stats.courses}`;
    }
  }

  if (topHits.length > 0) {
    prompt += "\n\nKnowledge base references:\n";
    topHits.forEach((hit, i) => {
      prompt += `[KB-${i + 1}] ${hit.title}\n${hit.content}\n\n`;
    });
  }
  return prompt;
}

async function enrichContext(session) {
  const result = { knowledgeRows: [], courses: [], attendance: [], leaves: [], evaluations: [], teachers: [] };

  // Always load knowledge base
  try { result.knowledgeRows = await readKnowledgeBase(); } catch (_) { /* ignore */ }

  // Always load courses with teachers (simple: fetch all, join in memory)
  try {
    const allCourses = await scanCollection("courses", 50);
    const allOfferings = await scanCollection("course_offerings", 50);
    const allTeachers = await scanCollection("teachers", 50);
    const allDepts = await scanCollection("departments", 30);
    const allSemesters = await scanCollection("semesters", 20);

    const deptMap = {};
    allDepts.forEach((d) => { deptMap[d._id] = d.name || ""; });
    const tMap = {};
    allTeachers.forEach((t) => { tMap[t._id] = t; });
    const semMap = {};
    allSemesters.forEach((s) => { semMap[s._id] = s.name || ""; });

    const active = allCourses.filter((c) => c.status === "active");
    result.courses = active.slice(0, 30).map((c) => {
      const offering = allOfferings.find((o) => o.course_id === c._id && o.selection_status === "open");
      const tNames = (offering && offering.teacher_ids || []).map((tid) => tMap[tid] ? tMap[tid].name : "").filter(Boolean);
      return {
        code: c.course_code || "",
        name: c.name || "",
        credits: c.credits || 0,
        semester: offering && offering.semester_id ? (semMap[offering.semester_id] || "") : "",
        teacher: tNames.join(", "),
        department: c.department_id ? (deptMap[c.department_id] || "") : "",
      };
    });

    result.teachers = allTeachers.slice(0, 20).map((t) => ({
      name: t.name || "",
      title: t.title || "",
      department: t.department_id ? (deptMap[t.department_id] || "") : "",
      fields: (t.research_fields || []).join(", "),
    }));
  } catch (_) { /* ignore */ }

  // Role-specific data
  if (session.role === "student") {
    try {
      result.userProfile = await buildStudentProfile(session.userId);
      result.attendance = await readStudentAttendance(session.userId);
      result.leaves = await readStudentLeaves(session.userId);
      result.grades = await buildGradeSummary(session.userId);
      result.graduation = await buildGraduationProgress(session.userId);
    } catch (_) { /* ignore */ }
  }

  if (session.role === "teacher") {
    try {
      const tProfile = await readTeacherProfile(session.userId);
      result.userProfile = tProfile ? tProfile.profile : "";
      if (tProfile) {
        result.attendance = await readTeacherAtRiskStudents(tProfile.teacherId);
        result.evaluations = await readTeacherEvaluationSummaries(tProfile.teacherId);
      }
    } catch (_) { /* ignore */ }
  }

  if (session.role === "admin") {
    try {
      result.evaluations = await readAllEvaluationSummaries();
      try {
        const s = await db.collection("students").where({ status: "active" }).count();
        const t = await db.collection("teachers").where({}).count();
        const c = await db.collection("courses").where({ status: "active" }).count();
        result.stats = { students: s.total || 0, teachers: t.total || 0, courses: c.total || 0 };
      } catch (_) { /* ignore */ }
    } catch (_) { /* ignore */ }
  }

  return result;
}

function buildHistoryMessages(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-10)
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({ role: item.role, content: item.content }));
}

function findTopMatches(rows, query, keywords, topK) {
  const cleanedQuery = query.toLowerCase();
  const scored = rows
    .map((item) => {
      const itemKeywords = Array.isArray(item.keywords) ? item.keywords : [];
      const hitCount = itemKeywords.reduce((sum, keyword) => {
        const normalized = singularize(String(keyword || "").toLowerCase());
        return sum + (keywords.includes(normalized) || cleanedQuery.includes(normalized) ? 1 : 0);
      }, 0);
      const titleHit = item.title && cleanedQuery.includes(String(item.title).toLowerCase()) ? 1 : 0;
      return { ...item, _score: hitCount + titleHit };
    })
    .filter((item) => item._score > 0)
    .sort((a, b) => b._score - a._score);
  return scored.slice(0, topK);
}

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
  if (active) return active;
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

async function purgeExpiredAiHistory(now = Date.now()) {
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

async function scanCollection(name, limit) {
  try {
    const result = await db.collection(name).limit(limit || 50).get();
    return result.data || [];
  } catch (_) { return []; }
}

function getById(list, id) {
  return (list || []).find((item) => item._id === id) || null;
}

function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(Number(ts));
  if (Number.isNaN(d.getTime())) return String(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function buildStudentProfile(userId) {
  try {
    const users = await scanCollection("users", 50);
    const user = users.find((u) => u._id === userId);
    const students = await scanCollection("students", 50);
    const student = students.find((s) => s.user_id === userId);
    if (!student) return "";
    const majors = await scanCollection("majors", 30);
    const major = majors.find((m) => m._id === student.major_id);
    let profile = `Student ID: ${student.student_no || ""}, Name: ${user ? user.display_name || student.name : student.name}, Enrollment: ${student.enrollment_year || ""}`;
    if (major) profile += `, Major: ${major.name}`;
    return profile;
  } catch (_) { return ""; }
}

async function readStudentAttendance(userId) {
  try {
    const students = await scanCollection("students", 50);
    const student = students.find((s) => s.user_id === userId);
    if (!student) return [];
    const records = await scanCollection("attendance_records", 50);
    const mine = records.filter((r) => r.student_id === student._id).slice(-20);
    const offerings = await scanCollection("course_offerings", 50);
    const courses = await scanCollection("courses", 50);
    return mine.map((r) => {
      const o = getById(offerings, r.course_offering_id);
      const c = o ? getById(courses, o.course_id) : null;
      return { date: formatDate(r.attendance_date), courseName: c ? `${c.course_code || ""} ${c.name || ""}`.trim() : (r.course_offering_id || ""), status: r.status };
    });
  } catch (_) { return []; }
}

async function readStudentLeaves(userId) {
  try {
    const students = await scanCollection("students", 50);
    const student = students.find((s) => s.user_id === userId);
    if (!student) return [];
    const leaves = await scanCollection("leave_requests", 50);
    const mine = leaves.filter((l) => l.student_id === student._id).slice(-20);
    const offerings = await scanCollection("course_offerings", 50);
    const courses = await scanCollection("courses", 50);
    return mine.map((l) => {
      const o = getById(offerings, l.course_offering_id);
      const c = o ? getById(courses, o.course_id) : null;
      return { date: formatDate(l.leave_date), courseName: c ? `${c.course_code || ""} ${c.name || ""}`.trim() : (l.course_offering_id || ""), status: l.status, type: l.reason_type };
    });
  } catch (_) { return []; }
}

async function buildGradeSummary(userId) {
  try {
    const students = await scanCollection("students", 50);
    const student = students.find((s) => s.user_id === userId);
    if (!student) return "";
    const grades = await scanCollection("grades", 100);
    const mine = grades.filter((g) => g.student_id === student._id);
    if (!mine.length) return "No grades on record.";
    const totalWeighted = mine.reduce((sum, r) => sum + (Number(r.grade_point) || 0) * (Number(r.credit) || 0), 0);
    const totalCredits = mine.reduce((sum, r) => sum + (Number(r.credit) || 0), 0);
    const gpa = totalCredits ? (totalWeighted / totalCredits) : 0;
    return `GPA: ${gpa.toFixed(2)}, Total Credits: ${totalCredits}`;
  } catch (_) { return ""; }
}

async function buildGraduationProgress(userId) {
  try {
    const students = await scanCollection("students", 50);
    const student = students.find((s) => s.user_id === userId);
    if (!student || !student.training_plan_id) return "";
    const reqs = await scanCollection("plan_requirements", 30);
    const myReqs = reqs.filter((r) => r.plan_id === student.training_plan_id);
    if (!myReqs.length) return "";
    const grades = await scanCollection("grades", 100);
    const myGrades = grades.filter((g) => g.student_id === student._id);
    const earned = myGrades.reduce((sum, g) => sum + (Number(g.credit) || 0), 0);
    const required = myReqs.reduce((sum, r) => sum + (Number(r.required_credits) || 0), 0);
    const cats = myReqs.map((r) => `${r.category || r.name}: ${r.required_credits} credits`).join(", ");
    return `${earned}/${required} credits. Requirements: ${cats}`;
  } catch (_) { return ""; }
}

async function readTeacherProfile(userId) {
  try {
    const teachers = await scanCollection("teachers", 50);
    const t = teachers.find((te) => te.user_id === userId);
    if (!t) return "";
    const depts = await scanCollection("departments", 30);
    const dept = depts.find((d) => d._id === t.department_id);
    let profile = `Name: ${t.name}, Title: ${t.title || ""}`;
    if (dept) profile += `, Department: ${dept.name}`;
    if (t.research_fields && t.research_fields.length) profile += `, Fields: ${t.research_fields.join(", ")}`;
    return { profile, teacherId: t._id };
  } catch (_) { return ""; }
}

async function readTeacherAtRiskStudents(teacherId) {
  try {
    const offerings = await scanCollection("course_offerings", 50);
    const myOfferings = offerings.filter((o) => (o.teacher_ids || []).includes(teacherId));
    const offeringIds = myOfferings.map((o) => o._id);
    const records = await scanCollection("attendance_records", 100);
    const absent = records.filter((r) => offeringIds.includes(r.course_offering_id) && r.status === "absent");
    const students = await scanCollection("students", 50);
    const counts = {};
    absent.forEach((r) => { counts[r.student_id] = (counts[r.student_id] || 0) + 1; });
    return Object.entries(counts).map(([sid, c]) => {
      const s = getById(students, sid);
      return { student: s ? (s.name || s.student_no) : sid, absences: c };
    });
  } catch (_) { return []; }
}

async function readTeacherEvaluationSummaries(teacherId) {
  try {
    const offerings = await scanCollection("course_offerings", 50);
    const myOfferings = offerings.filter((o) => (o.teacher_ids || []).includes(teacherId));
    const offeringIds = myOfferings.map((o) => o._id);
    const evals = await scanCollection("course_evaluations", 100);
    const mine = evals.filter((e) => offeringIds.includes(e.course_offering_id));
    const courses = await scanCollection("courses", 50);
    const groups = {};
    mine.forEach((e) => {
      const key = e.course_offering_id;
      if (!groups[key]) groups[key] = { total: 0, count: 0, diffTotal: 0 };
      const scores = e.scores || {};
      const dims = Object.values(scores).filter((v) => typeof v === "number");
      groups[key].total += dims.reduce((s, v) => s + v, 0);
      groups[key].count += dims.length;
      groups[key].diffTotal += Number(scores.difficulty || 0);
    });
    return Object.entries(groups).map(([oid, g]) => {
      const o = getById(myOfferings, oid);
      const c = o ? getById(courses, o.course_id) : null;
      return {
        courseName: c ? `${c.course_code || ""} ${c.name || ""}`.trim() : oid,
        avg: g.count ? (g.total / g.count).toFixed(1) : "0",
        count: Math.round(g.count / 6),
        diffAvg: g.count ? (g.diffTotal / Math.max(1, g.count / 6)).toFixed(1) : "0",
      };
    });
  } catch (_) { return []; }
}

async function readAllEvaluationSummaries() {
  try {
    const evals = await scanCollection("course_evaluations", 200);
    const offerings = await scanCollection("course_offerings", 50);
    const courses = await scanCollection("courses", 50);
    const groups = {};
    evals.forEach((e) => {
      const key = e.course_offering_id;
      if (!groups[key]) groups[key] = { total: 0, count: 0 };
      const scores = e.scores || {};
      Object.values(scores).filter((v) => typeof v === "number").forEach((v) => { groups[key].total += v; groups[key].count++; });
    });
    return Object.entries(groups).map(([oid, g]) => {
      const o = getById(offerings, oid);
      const c = o ? getById(courses, o.course_id) : null;
      return {
        courseName: c ? `${c.course_code || ""} ${c.name || ""}`.trim() : oid,
        avg: g.count ? (g.total / g.count).toFixed(1) : "0",
        count: Math.round(g.count / 6),
        diffAvg: "N/A",
      };
    });
  } catch (_) { return []; }
}

function buildQueryKeywords(query) {
  const cleaned = query
    .toLowerCase()
    .replace(/[^一-龥a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned ? cleaned.split(" ") : [];
  return Array.from(new Set(words.flatMap((word) => [word, singularize(word)]).filter(Boolean)));
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
