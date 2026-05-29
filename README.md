# AI-EMS

AI-EMS is a Uniapp + UniCloud proof-of-concept for an AI-enhanced educational management system. It focuses on role-based access, leave-to-attendance workflow, anonymous course evaluation, academic planning, profile-review workflows, course materials, location check-in, and local knowledge-base retrieval.

## Tech Stack

- Frontend: Uniapp
- Cloud backend: UniCloud cloud functions
- Database: UniCloud database collections
- AI scope: local keyword retrieval from the `knowledge_base` collection

## Accounts

Login accounts are loaded from the `users` collection and validated against `users.password_hash`. In H5 fallback mode, use:

| Role | Username | Password |
|---|---|---|
| Student | `student001` | `demo123` |
| Teacher | `teacher001` | `demo123` |
| Admin | `admin001` | `demo123` |

## Main Demo Flows

1. Login with different roles and open the corresponding dashboard.
2. Student refreshes the dashboard, checks academic progress/recommendations/alerts, and reads visible course materials.
3. Student submits a leave request; teacher/admin approves it; attendance status becomes `on_leave`; cancellation restores the previous status.
4. Student submits anonymous multi-dimensional course evaluation; teacher/admin sees aggregated feedback only; the local knowledge base receives a course-feedback entry.
5. Student/teacher submits editable profile fields for review; admin approves or rejects the pending change.
6. Student performs a location check-in against the classroom geofence.
7. Assistant answers from `knowledge_base`; unknown questions trigger a safe fallback.

## UniCloud Setup

1. Open the project in HBuilderX.
2. Confirm the project is linked to the Aliyun UniCloud space.
3. Upload the cloud functions under `uniCloud-aliyun/cloudfunctions`.
4. Create/import collections under `uniCloud-aliyun/database`.
5. Import collection data from `uniCloud-aliyun/database/import/` or your own UniCloud export files.

H5 preview can run without a linked UniCloud space. `common/api.js` uses short-lived read caching, in-flight read de-duplication, write-triggered cache invalidation, and a local fallback data set when `uniCloud` is unavailable or a cloud call fails.

Import files use UniCloud JSONL format: one JSON document per line. Demo import files are provided for every schema except `users` and `password_reset_tokens`, which are managed separately.

AI assistant history is stored in `ai_conversations` and `ai_messages`. Each conversation has `user_id`, so history is scoped to the logged-in person. `ask-assistant` and `get-ai-history` both remove records older than 60 days when called.

## Scope Limits

- This PoC does not use MySQL.
- This PoC does not implement production SSO or full `uni-id` login.
- This PoC does not connect DeepSeek, LangChain or Pinecone yet.
- This PoC does not generate official academic documents.
