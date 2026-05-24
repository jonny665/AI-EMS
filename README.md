# AI-EMS

AI-EMS is a Uniapp + UniCloud proof-of-concept for an AI-enhanced educational management system. It focuses on role-based access, leave-to-attendance workflow, anonymous course evaluation, and local knowledge-base retrieval.

## Tech Stack

- Frontend: Uniapp
- Cloud backend: UniCloud cloud functions
- Database: UniCloud database collections
- AI scope: local knowledge-base retrieval with fallback

## Demo Accounts

| Role | Username | Password |
|---|---|---|
| Student | `student001` | `demo123` |
| Teacher | `teacher001` | `demo123` |
| Administrator | `admin001` | `demo123` |

## Main Demo Flows

1. Login with different roles and open the corresponding dashboard.
2. Student submits a leave request; teacher/admin approves it; attendance status becomes `on_leave`.
3. Student submits anonymous course evaluation; teacher/admin sees aggregated feedback only.
4. Assistant answers from `knowledge_base`; unknown questions trigger a safe fallback.

## UniCloud Setup

1. Open the project in HBuilderX.
2. Confirm the project is linked to the Aliyun UniCloud space.
3. Upload the cloud functions under `uniCloud-aliyun/cloudfunctions`.
4. Create/import collections under `uniCloud-aliyun/database`.
5. Import sample records from `uniCloud-aliyun/database/demo-seed-data.json`.

The frontend includes local fallback data, so H5 preview can still show the PoC flows before cloud upload.

## Scope Limits

- This PoC does not use MySQL.
- This PoC does not implement production SSO or full `uni-id` login.
- This PoC does not connect DeepSeek, LangChain or Pinecone yet.
- This PoC does not generate official academic documents.
