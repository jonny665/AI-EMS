"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createMockDb(seed = {}) {
  const collections = new Map();
  for (const [name, rows] of Object.entries(seed)) {
    collections.set(name, rows.map(clone));
  }

  function ensure(name) {
    if (!collections.has(name)) collections.set(name, []);
    return collections.get(name);
  }

  function match(doc, query) {
    return Object.entries(query).every(([key, value]) => doc[key] === value);
  }

  function query(items) {
    let current = items.slice();
    return {
      where(next) {
        current = current.filter((doc) => match(doc, next));
        return this;
      },
      limit(count) {
        current = current.slice(0, count);
        return this;
      },
      get() {
        return Promise.resolve({ data: current.map(clone) });
      },
    };
  }

  return {
    collection(name) {
      const docs = ensure(name);
      return {
        add(doc) {
          const stored = clone(doc);
          if (!stored._id) stored._id = `${name}_${docs.length + 1}`;
          docs.push(stored);
          return Promise.resolve({ id: stored._id });
        },
        doc(id) {
          return {
            get() {
              const row = docs.find((doc) => doc._id === id);
              return Promise.resolve({ data: row ? [clone(row)] : [] });
            },
            update(updateDoc) {
              const row = docs.find((doc) => doc._id === id);
              if (row) Object.assign(row, clone(updateDoc));
              return Promise.resolve({ updated: row ? 1 : 0 });
            },
            remove() {
              const index = docs.findIndex((doc) => doc._id === id);
              if (index >= 0) docs.splice(index, 1);
              return Promise.resolve({ deleted: index >= 0 ? 1 : 0 });
            },
          };
        },
        where(next) {
          return query(docs.filter((doc) => match(doc, next)));
        },
        limit(count) {
          return query(docs).limit(count);
        },
        get() {
          return Promise.resolve({ data: docs.map(clone) });
        },
      };
    },
    snapshot(name) {
      return ensure(name).map(clone);
    },
  };
}

function loadCloudFunction(filePath, mockDb) {
  const code = fs.readFileSync(filePath, "utf8");
  const sandbox = {
    exports: {},
    module: { exports: {} },
    uniCloud: { database: () => mockDb },
    console,
    Date,
    Math,
    JSON,
    String,
    Number,
    Boolean,
    RegExp,
    Object,
    Array,
    Promise,
    setTimeout,
    clearTimeout,
    Buffer,
    require,
    __dirname: path.dirname(filePath),
    __filename: filePath,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: filePath });
  return sandbox.exports.main || sandbox.module.exports.main;
}

async function main() {
  const now = Date.now();
  const old = now - 75 * 24 * 60 * 60 * 1000;
  const db = createMockDb({
    knowledge_base: [
      {
        _id: "kb_graduation",
        title: "Graduation credit requirement",
        keywords: ["graduation", "credit"],
        content: "Track total credits, module credits, GPA trend and remaining required courses.",
        category: "policy",
      },
    ],
    ai_conversations: [
      { _id: "conv_old", user_id: "user_s_001", title: "Old", scenario: "other", message_count: 2, status: "active", created_at: old, updated_at: old },
      { _id: "conv_other_user", user_id: "user_t_001", title: "Teacher", scenario: "other", message_count: 2, status: "active", created_at: now, updated_at: now },
    ],
    ai_messages: [
      { _id: "msg_old", conversation_id: "conv_old", role: "user", content: "old", fallback_used: false, created_at: old },
      { _id: "msg_other_user", conversation_id: "conv_other_user", role: "user", content: "teacher private", fallback_used: false, created_at: now },
    ],
    audit_logs: [],
  });

  const root = path.join(__dirname, "..", "uniCloud-aliyun", "cloudfunctions");
  const ask = loadCloudFunction(path.join(root, "ask-assistant", "index.js"), db);
  const history = loadCloudFunction(path.join(root, "get-ai-history", "index.js"), db);
  const session = { userId: "user_s_001", role: "student" };

  const askResult = await ask({ session, query: "What should I check before graduation?" });
  assert.equal(askResult.ok, true);
  assert.ok(askResult.data.conversationId);

  const historyResult = await history({ session });
  assert.equal(historyResult.ok, true);
  assert.equal(historyResult.data.userId, "user_s_001");
  assert.ok(historyResult.data.messages.length >= 2);
  assert.equal(historyResult.data.messages.some((item) => item.content === "teacher private"), false);
  assert.equal(db.snapshot("ai_messages").some((item) => item._id === "msg_old"), false);
  assert.equal(db.snapshot("ai_conversations").some((item) => item._id === "conv_old"), false);

  console.log("ai history smoke ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
