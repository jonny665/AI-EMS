# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

AI-EMS is a Uniapp + UniCloud (Aliyun) proof-of-concept for an AI-enhanced educational management system. It demonstrates role-based access (student/teacher/admin), leave-to-attendance workflow, anonymous course evaluation, and local knowledge-base Q&A.

- **Frontend**: Uniapp with Vue 3 (`vueVersion: "3"` in manifest.json)
- **Cloud backend**: UniCloud cloud functions (Node.js) on Aliyun
- **Database**: UniCloud NoSQL collections (schemas in `uniCloud-aliyun/database/`)
- **AI**: Local keyword-based knowledge retrieval with Chinese fallback message

## Build & Development

This is a HBuilderX project. There is no CLI build tooling.

- Open the project root in **HBuilderX** to develop and preview
- **H5 preview** works without any cloud setup — the frontend uses hardcoded fallback data when UniCloud is unavailable
- Upload cloud functions via HBuilderX: right-click each function in `uniCloud-aliyun/cloudfunctions/` and select "Upload"
- Import database schemas from `uniCloud-aliyun/database/` via HBuilderX's uniCloud console
- Seed data: `uniCloud-aliyun/database/demo-seed-data.json`

Demo accounts (password for all: `demo123`):

| Role | Username |
|---|---|
| Student | `student001` |
| Teacher | `teacher001` |
| Admin | `admin001` |

## Architecture

### Frontend layers

```
pages/           # Vue SFC pages (login, dashboards, leave, evaluation, assistant)
common/api.js    # Unified cloud function caller with full local fallback for every endpoint
common/session.js # Session storage (uni.setStorageSync), role gating, dashboard URL routing
App.vue          # Global app shell + shared CSS classes
```

### Cloud functions (`uniCloud-aliyun/cloudfunctions/`)

Seven cloud functions, each with its own `index.js` and `package.json`:

| Function | Role access | Purpose |
|---|---|---|
| `auth-login` | all | Authenticate against `users` collection or demo fallback |
| `get-dashboard-data` | all | Load user-specific courses, attendance, leaves, evaluation summary |
| `submit-leave` | student | Create a leave request; writes to `leave_requests` |
| `review-leave` | teacher, admin | Approve/reject leave; syncs attendance to `on_leave` on approval |
| `submit-evaluation` | student | Submit anonymous course evaluation; writes to `course_evaluations` |
| `get-evaluation-summary` | all | Aggregated ratings and feedback per course (anonymous) |
| `ask-assistant` | all | Keyword-match question against `knowledge_base` collection; safe fallback on no match |

### Dual-mode fallback pattern

Every cloud function call goes through `callAiemsFunction(name, data)` in `common/api.js`. If `uniCloud` is undefined (H5 preview) or the cloud call fails, it falls back to `fallbackResult()` which operates entirely on in-memory demo state. This means:

- The entire PoC is runnable in H5 preview without any cloud setup
- Adding a new cloud function should include a corresponding fallback case in `fallbackResult()`
- Demo data is hardcoded in both the cloud functions and `common/api.js` — keep them consistent

### Session & auth

There is no real SSO or uni-id integration. On login, user info (`userId`, `username`, `role`, `displayName`) is stored to `uni.storage` via `session.js`. The `requireRole(allowedRoles)` function guards pages — redirects to login if no session or wrong role.

### Leave → attendance sync

When a leave request is approved (`review-leave`), the cloud function creates or updates an `attendance_records` row with `status: 'on_leave'`. The frontend fallback in `api.js` mimics this same behavior in `fallbackResult('review-leave', ...)`.

### Database

40+ collection schemas are defined in `uniCloud-aliyun/database/`. See `uniCloud-aliyun/database/README.md` for the full field listing and purpose of each table. The PoC only actively uses a subset: `users`, `courses`, `leave_requests`, `attendance_records`, `course_evaluations`, `knowledge_base`, `audit_logs`.

## Scope Limits (from README)

- No MySQL — UniCloud NoSQL only
- No production SSO or full `uni-id` login
- No DeepSeek, LangChain, or Pinecone integration yet
- No official academic document generation
