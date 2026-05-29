"use strict";

const db = uniCloud.database();

const EDITABLE_FIELDS = {
  student: {
    "contact.email": "Email",
    "contact.phone": "Phone",
    "contact.address": "Address",
    "family_info.guardianName": "Guardian Name",
    "family_info.guardianPhone": "Guardian Phone",
    "familyInfo.guardianName": "Guardian Name",
    "familyInfo.guardianPhone": "Guardian Phone",
  },
  teacher: {
    office: "Office",
    teaching_experience: "Teaching Experience",
    teachingExperience: "Teaching Experience",
    research_fields: "Research Fields",
    researchFields: "Research Fields",
    "public_profile.officeHours": "Office Hours",
    "public_profile.homepage": "Homepage",
    "publicProfile.officeHours": "Office Hours",
    "publicProfile.homepage": "Homepage",
  },
};

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (!session.userId || !["student", "teacher"].includes(session.role)) {
    return { ok: false, message: "Only students or teachers can submit profile changes." };
  }

  const target = await resolveTarget(session);
  if (!target) {
    return { ok: false, message: "Profile was not found." };
  }

  const changes = normalizeChanges(session.role, target, event.changes || event);
  if (!Object.keys(changes).length) {
    return { ok: false, message: "No editable profile fields were changed." };
  }

  const now = Date.now();
  const request = {
    requester_user_id: session.userId,
    target_type: session.role,
    target_id: target._id,
    changes,
    status: "pending",
    reviewer_user_id: "",
    review_comment: "",
    reviewed_at: 0,
    created_at: now,
    updated_at: now,
  };

  const result = await db.collection("profile_change_requests").add(request);
  await writeAudit("profile.submit", session, result.id, null, request);

  return {
    ok: true,
    data: {
      request: {
        _id: result.id,
        ...request,
      },
    },
  };
};

async function resolveTarget(session) {
  const collection = session.role === "teacher" ? "teachers" : "students";
  const result = await db.collection(collection).where({ user_id: session.userId }).limit(1).get();
  return result.data && result.data[0] ? result.data[0] : null;
}

function normalizeChanges(role, target, raw) {
  const fields = EDITABLE_FIELDS[role] || {};
  const changes = {};

  for (const [field, label] of Object.entries(fields)) {
    const nextValue = readInputValue(raw, field);
    if (nextValue === undefined) {
      continue;
    }

    const canonicalField = canonicalizeField(field);
    if (changes[canonicalField]) {
      continue;
    }

    const oldValue = getByPath(target, canonicalField);
    const normalizedNewValue = normalizeValue(nextValue);
    if (stableStringify(oldValue || "") === stableStringify(normalizedNewValue || "")) {
      continue;
    }

    changes[canonicalField] = {
      oldValue: oldValue === undefined ? "" : oldValue,
      newValue: normalizedNewValue,
      label,
    };
  }

  return changes;
}

function canonicalizeField(field) {
  return String(field)
    .replace(/^familyInfo\./, "family_info.")
    .replace(/^publicProfile\./, "public_profile.")
    .replace(/^teachingExperience$/, "teaching_experience")
    .replace(/^researchFields$/, "research_fields");
}

function readInputValue(raw, field) {
  if (Object.prototype.hasOwnProperty.call(raw, field)) {
    return unwrapValue(raw[field]);
  }

  const alternate = canonicalizeField(field);
  if (Object.prototype.hasOwnProperty.call(raw, alternate)) {
    return unwrapValue(raw[alternate]);
  }

  return getByPath(raw, field);
}

function unwrapValue(value) {
  if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "newValue")) {
    return value.newValue;
  }
  return value;
}

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || "").trim();
}

function getByPath(object, path) {
  return String(path)
    .split(".")
    .reduce((current, key) => (current && Object.prototype.hasOwnProperty.call(current, key) ? current[key] : undefined), object);
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
    console.warn("[submit-profile-change] audit write skipped.", error);
  }
}
