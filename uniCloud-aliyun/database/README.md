# AI-EMS UniCloud Database

This PoC uses UniCloud database collections as the primary data layer.

## Collections

- `users`: demo accounts and roles.
- `courses`: course metadata.
- `attendance_records`: attendance state by student, course and date.
- `leave_requests`: leave submission and review workflow.
- `course_evaluations`: anonymous evaluation payloads.
- `knowledge_base`: local retrieval knowledge items.
- `audit_logs`: critical actions such as login, leave review and assistant queries.

## Demo Data

Use `demo-seed-data.json` as the source data for initial manual import in the UniCloud web console or HBuilderX database view.

The frontend also includes a local fallback so the H5 preview remains demonstrable before the cloud functions and collections are uploaded.
