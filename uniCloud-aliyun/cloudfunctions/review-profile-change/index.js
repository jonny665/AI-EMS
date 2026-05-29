"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (session.role !== "admin" || !session.userId) {
    return { ok: false, message: "Only administrators can review profile changes." };
  }

  const requestId = String(event.requestId || event.profileChangeRequestId || "").trim();
  const decision = String(event.decision || "").trim();
  const reviewComment = String(event.reviewComment || event.comment || "").trim();

  if (!requestId || !["approved", "rejected"].includes(decision)) {
    return { ok: false, message: 'Request id and decision "approved" or "rejected" are required.' };
  }

  const request = await findById("profile_change_requests", requestId);
  if (!request) {
    return { ok: false, message: "Profile change request not found." };
  }
  if (request.status !== "pending") {
    return { ok: false, message: "Profile change request has already been processed." };
  }

  const now = Date.now();
  const update = {
    status: decision,
    reviewer_user_id: session.userId,
    review_comment: reviewComment,
    reviewed_at: now,
    updated_at: now,
  };

  let applied = null;
  if (decision === "approved") {
    applied = await applyChanges(request, now);
  }

  await db.collection("profile_change_requests").doc(requestId).update(update);
  await writeAudit("profile.review", session, requestId, request, { ...request, ...update, applied });

  return {
    ok: true,
    data: {
      request: {
        _id: requestId,
        ...request,
        ...update,
      },
      applied,
    },
  };
};

async function applyChanges(request, now) {
  const collection = request.target_type === "teacher" ? "teachers" : "students";
  const target = await findById(collection, request.target_id);
  if (!target) {
    return { updated: false, message: "Target profile not found." };
  }

  const next = clone(target);
  for (const [field, change] of Object.entries(request.changes || {})) {
    setByPath(next, field, change.newValue);
  }
  next.updated_at = now;

  const update = buildChangedDocument(target, next);
  await db.collection(collection).doc(target._id).update(update);

  if (collection === "students" && next.contact) {
    await syncUserContact(target.user_id, next.contact, now);
  }

  return {
    updated: true,
    collection,
    targetId: target._id,
    fields: Object.keys(request.changes || {}),
  };
}

async function syncUserContact(userId, contact, now) {
  if (!userId) {
    return;
  }
  const update = { updated_at: now };
  if (contact.email) {
    update.email = contact.email;
  }
  if (contact.phone) {
    update.phone = contact.phone;
  }
  try {
    await db.collection("users").doc(userId).update(update);
  } catch (error) {
    console.warn("[review-profile-change] user contact sync skipped.", error);
  }
}

function buildChangedDocument(before, after) {
  const update = {};
  for (const [key, value] of Object.entries(after)) {
    if (key === "_id") {
      continue;
    }
    if (stableStringify(before[key]) !== stableStringify(value)) {
      update[key] = value;
    }
  }
  return update;
}

async function findById(collection, id) {
  try {
    const result = await db.collection(collection).doc(id).get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    console.warn(`[review-profile-change] ${collection} lookup failed.`, error);
    return null;
  }
}

function setByPath(object, path, value) {
  const keys = String(path).split(".");
  let current = object;
  keys.slice(0, -1).forEach((key) => {
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  });
  current[keys[keys.length - 1]] = value;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function writeAudit(action, session, targetId, before, after) {
  try {
    await db.collection("audit_logs").add({
      action,
      actor_user_id: session.userId,
      target_collection: "profile_change_requests",
      target_id: targetId,
      before,
      after,
      created_at: Date.now(),
    });
  } catch (error) {
    console.warn("[review-profile-change] audit write skipped.", error);
  }
}
