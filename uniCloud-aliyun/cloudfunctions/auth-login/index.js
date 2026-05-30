"use strict";

const crypto = require("crypto");
const db = uniCloud.database();

exports.main = async (event = {}) => {
  const username = String(event.username || "").trim();
  const password = String(event.password || "");

  if (!username || !password) {
    return { ok: false, message: "Username and password are required." };
  }

  const userResult = await db.collection("users").where({ username }).limit(1).get();
  const user = userResult.data && userResult.data[0];
  if (!user) {
    console.warn("[auth-login] user not found.", { username });
    return { ok: false, message: "Account not found." };
  }

  if (user.status !== "active") {
    console.warn("[auth-login] inactive account.", { username, status: user.status });
    return { ok: false, message: "Account is inactive." };
  }

  if (!verifyPassword(password, user.password_hash)) {
    console.warn("[auth-login] password mismatch.", { username, hasPasswordHash: Boolean(user.password_hash) });
    return { ok: false, message: "Invalid account or password." };
  }

  const roles = await loadRoles(user.role_ids);
  const role = resolvePrimaryRole(roles) || resolvePrimaryRoleByCodes(user.role_ids) || resolvePrimaryRoleByCodes([user.role]);
  if (!role) {
    return { ok: false, message: "This account has no valid role." };
  }

  const now = Date.now();
  await db.collection("users").doc(user._id).update({ last_login_at: now, updated_at: now });
  await writeAudit("login", user._id, role, { username });

  return {
    ok: true,
    user: {
      userId: user._id,
      username,
      role,
      roleCodes: roles.map((item) => item.code),
      displayName: user.display_name || user.displayName || user.username,
      mustChangePassword: Boolean(user.must_change_password),
    },
  };
};

async function loadRoles(roleIds = []) {
  if (!Array.isArray(roleIds) || !roleIds.length) {
    return [];
  }

  const roles = [];
  for (const roleId of roleIds) {
    try {
      const result = await db.collection("roles").doc(roleId).get();
      const role = result.data && result.data[0];
      if (role && role.code) {
        roles.push(role);
      }
    } catch (error) {
      console.warn("[auth-login] role lookup skipped.", error);
    }
  }
  return roles;
}

function resolvePrimaryRole(roles) {
  const codes = roles.map((item) => item.code);
  return resolvePrimaryRoleByCodes(codes);
}

function resolvePrimaryRoleByCodes(codes) {
  const list = Array.isArray(codes)
    ? codes.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const priority = ["admin", "academic_staff", "teacher", "counselor", "student", "guardian"];
  const code = priority.find((item) => list.includes(item));

  if (code === "academic_staff") {
    return "admin";
  }
  if (code === "counselor") {
    return "teacher";
  }
  return code || "";
}

function verifyPassword(password, verifier) {
  const value = String(verifier || "");
  if (!value) {
    return false;
  }

  if (/^[a-f0-9]{64}$/i.test(value)) {
    return timingSafeCompare(sha256Hex(password), value.toLowerCase());
  }

  if (value.startsWith("sha256$")) {
    return timingSafeCompare(sha256Hex(password), value.slice("sha256$".length).toLowerCase());
  }

  if (value.startsWith("pbkdf2_sha256$")) {
    return verifyPbkdf2Sha256(password, value);
  }

  return false;
}

function verifyPbkdf2Sha256(password, verifier) {
  const parts = verifier.split("$");
  if (parts.length !== 4) {
    return false;
  }

  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 10000) {
    return false;
  }

  try {
    const salt = decodeBase64(parts[2]);
    const expected = decodeBase64(parts[3]);
    const actual = crypto.pbkdf2Sync(password, salt, iterations, expected.length, "sha256");
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (error) {
    console.warn("[auth-login] password verification failed.", error);
    return false;
  }
}

function decodeBase64(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 ? "=".repeat(4 - (normalized.length % 4)) : "";
  return Buffer.from(normalized + padding, "base64");
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function timingSafeCompare(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function writeAudit(action, userId, role, detail) {
  try {
    await db.collection("audit_logs").add({
      action,
      actor_user_id: userId,
      target_collection: "users",
      target_id: userId,
      after: { role, detail },
      created_at: Date.now(),
    });
  } catch (error) {
    console.warn("[auth-login] audit write skipped.", error);
  }
}
