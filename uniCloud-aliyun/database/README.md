# AI-EMS Database README

This folder contains UniCloud collection schemas and demo import data for the AI-EMS proof of concept.

## Import Data

Demo data lives in `uniCloud-aliyun/database/import/`.

- Files ending in `.import.json` are JSONL import files: one JSON object per line.
- Files ending in `.raw.DO_NOT_IMPORT.json` are source/reference files and should not be imported directly.
- Password import data stores only one-way password verifiers in `users.password_hash`.

## Current Teacher-Course Mapping

The relationship is defined by `course_offerings.teacher_ids`, which references `teachers._id`.

| Teacher | Login username | Course offering | Course | Semester | Section | Status | Enrolled / Capacity |
|---|---|---|---|---|---|---|---|
| Alice Chen (`T1001`) | `t1001` | `offering_sd_2026s` | `JC3506 Software Design and Implementation` | 2026 Spring | 01 | open | 32 / 50 |
| Alice Chen (`T1001`) | `t1001` | `offering_pm_2026s` | `PM3506 Software Process Management` | 2026 Spring | 01 | open | 28 / 45 |
| Alice Chen (`T1001`) | `t1001` | `offering_da_2026s` | `DA3506 Educational Data Analysis` | 2026 Spring | 01 | open | 22 / 40 |
| Brian Li (`T1002`) | `t1002` | `offering_db_2026s` | `DB2501 Database Principles` | 2026 Spring | 02 | closed | 35 / 55 |

Note: H5 local fallback data in `common/api.js` uses the lightweight demo account `teacher001` / `Dr. Zhang`, who manages the three fallback courses `JC3506`, `PM3506`, and `DA3506`. The table above reflects the database import files.

## Collections

### Auth And Users

- `roles`: role definitions and permission keys.
  Fields: `_id`, `code`, `name`, `permissions`, `created_at`, `updated_at`.
- `users`: login accounts, password verifier, role ids, contact fields, account status.
  Fields: `_id`, `username`, `password_hash`, `role_ids`, `display_name`, `email`, `phone`, `avatar_url`, `status`, `last_login_at`, `password_updated_at`, `must_change_password`, `created_at`, `updated_at`.
- `sso_identities`: optional external SSO identity binding.
  Fields: `_id`, `user_id`, `provider`, `provider_uid`, `created_at`, `updated_at`.
- `password_reset_tokens`: one-way reset tokens for forgotten-password or admin-reset flows.
  Fields: `_id`, `user_id`, `token_hash`, `purpose`, `expires_at`, `used_at`, `status`, `request_ip`, `created_at`, `updated_at`.

### People And Organization

- `departments`: school, college, department, or office hierarchy.
  Fields: `_id`, `code`, `name`, `parent_id`, `created_at`, `updated_at`.
- `majors`: major/program definitions.
  Fields: `_id`, `code`, `name`, `department_id`, `degree_type`, `duration_years`, `created_at`, `updated_at`.
- `admin_classes`: administrative class groups and counselor ownership.
  Fields: `_id`, `code`, `name`, `major_id`, `grade_year`, `counselor_user_id`, `created_at`, `updated_at`.
- `students`: student profile, immutable identifiers, contact, family info, training plan.
  Fields: `_id`, `user_id`, `student_no`, `name`, `gender`, `major_id`, `admin_class_id`, `enrollment_year`, `training_plan_id`, `photo_url`, `contact`, `family_info`, `status`, `percentile_rank`, `created_at`, `updated_at`.
- `teachers`: teacher profile, public teaching information, research fields.
  Fields: `_id`, `user_id`, `teacher_no`, `name`, `department_id`, `title`, `research_fields`, `teaching_experience`, `office`, `public_profile`, `status`, `created_at`, `updated_at`.
- `guardians`: parent/guardian contacts used by alert notifications.
  Fields: `_id`, `student_id`, `user_id`, `name`, `relationship`, `phone`, `email`, `receive_alerts`, `created_at`, `updated_at`.

### Courses, Teaching, And Grades

- `semesters`: academic terms.
  Fields: `_id`, `code`, `name`, `start_date`, `end_date`, `is_current`, `created_at`, `updated_at`.
- `classrooms`: room capacity and geofence coordinates for location check-in.
  Fields: `_id`, `building`, `room_no`, `name`, `capacity`, `latitude`, `longitude`, `geofence_radius_m`, `created_at`, `updated_at`.
- `courses`: course catalog records.
  Fields: `_id`, `course_code`, `name`, `department_id`, `credits`, `course_type`, `difficulty_level`, `description`, `status`, `created_at`, `updated_at`.
- `course_prerequisites`: prerequisite graph used by course recommendation.
  Fields: `_id`, `course_id`, `prerequisite_course_id`, `rule_type`, `min_score`, `created_at`.
- `course_offerings`: actual semester course sections; `teacher_ids` controls teacher ownership.
  Fields: `_id`, `course_id`, `semester_id`, `section_no`, `teacher_ids`, `capacity`, `enrolled_count`, `selection_status`, `syllabus_url`, `created_at`, `updated_at`.
- `class_sessions`: concrete class time/location rows used by timetable, attendance, and leave sync.
  Fields: `_id`, `course_offering_id`, `classroom_id`, `weekday`, `start_time`, `end_time`, `week_start`, `week_end`, `session_date`, `status`, `created_at`, `updated_at`.
- `course_materials`: teacher/admin managed course resources.
  Fields: `_id`, `course_offering_id`, `uploader_user_id`, `title`, `file_url`, `file_type`, `is_public_to_students`, `knowledge_document_id`, `created_at`, `updated_at`.
- `enrollments`: student-course selection records.
  Fields: `_id`, `student_id`, `course_offering_id`, `status`, `selected_at`, `dropped_at`, `created_at`, `updated_at`.
- `grades`: course results, GPA point, earned credits, and percentile.
  Fields: `_id`, `enrollment_id`, `student_id`, `course_offering_id`, `score`, `grade_letter`, `gpa_point`, `credits_earned`, `percentile`, `status`, `published_at`, `created_at`, `updated_at`.

### Training Plan And Recommendation

- `training_plans`: major/year graduation plan.
  Fields: `_id`, `major_id`, `grade_year`, `name`, `total_required_credits`, `status`, `created_at`, `updated_at`.
- `plan_requirements`: credit module requirements in a training plan.
  Fields: `_id`, `training_plan_id`, `module_code`, `module_name`, `required_credits`, `course_ids`, `rule`, `created_at`, `updated_at`.
- `interest_tags`: elective/recommendation interest taxonomy.
  Fields: `_id`, `code`, `name`, `description`, `created_at`.
- `student_interest_tags`: student-selected interest tags and weights.
  Fields: `_id`, `student_id`, `tag_id`, `weight`, `created_at`.
- `course_recommendations`: generated recommendation results and evidence.
  Fields: `_id`, `student_id`, `semester_id`, `recommended_course_id`, `recommended_offering_id`, `path_name`, `score`, `reason`, `evidence`, `status`, `created_at`, `updated_at`.

### Attendance, Leave, And Alerts

- `attendance_records`: per-student per-session attendance. Leave approval writes `status: "on_leave"` here.
  Fields: `_id`, `student_id`, `course_offering_id`, `class_session_id`, `attendance_date`, `status`, `checkin_at`, `checkin_latitude`, `checkin_longitude`, `distance_to_classroom_m`, `source`, `leave_request_id`, `remark`, `created_at`, `updated_at`.
- `leave_requests`: student leave requests and teacher/admin review results.
  Fields: `_id`, `student_id`, `course_offering_id`, `leave_date`, `reason_type`, `reason_detail`, `start_at`, `end_at`, `attachment_urls`, `status`, `reviewer_user_id`, `review_comment`, `reviewed_at`, `created_at`, `updated_at`.
- `leave_request_sessions`: link table that stores the attendance row touched by an approved leave and the previous attendance status for cancellation restore.
  Fields: `_id`, `leave_request_id`, `class_session_id`, `attendance_record_id`, `previous_status`, `previous_source`, `created_at`, `updated_at`.
- `academic_alerts`: generated/managed academic risk alerts.
  Fields: `_id`, `student_id`, `course_offering_id`, `alert_type`, `severity`, `trigger_rule`, `message`, `assigned_to_user_id`, `status`, `created_at`, `resolved_at`.

### Evaluation And Local AI Knowledge

- `evaluation_tokens`: optional anonymous evaluation token lifecycle.
  Fields: `_id`, `token_hash`, `course_offering_id`, `expires_at`, `used_at`, `status`, `created_at`.
- `course_evaluations`: anonymous multi-dimensional course evaluations. It stores `token_hash`, not student identity.
  Fields: `_id`, `course_id`, `course_offering_id`, `teacher_ids`, `token_hash`, `scores`, `difficulty_score`, `workload_score`, `feedback_text`, `status`, `submitted_at`, `created_at`, `updated_at`.
- `course_evaluation_summaries`: aggregate evaluation statistics and optional AI summary.
  Fields: `_id`, `course_id`, `course_offering_id`, `semester_id`, `evaluation_count`, `average_scores`, `positive_tags`, `negative_tags`, `ai_summary`, `knowledge_document_id`, `updated_at`.
- `knowledge_base`: local keyword-based Q&A records used before DeepSeek/Pinecone integration.
  Fields: `_id`, `title`, `keywords`, `content`, `category`, `createTime`, `updateTime`.
- `knowledge_documents`: source documents for policy/course/material/evaluation knowledge.
  Fields: `_id`, `title`, `source_type`, `source_id`, `file_url`, `content_hash`, `visibility_roles`, `status`, `owner_user_id`, `created_at`, `updated_at`.
- `knowledge_chunks`: future vector-search chunks; currently retained for later Pinecone/LangChain integration.
  Fields: `_id`, `document_id`, `chunk_index`, `content`, `embedding_provider`, `vector_id`, `metadata`, `created_at`, `updated_at`.
- `ai_conversations`: assistant conversation metadata.
  Fields: `_id`, `user_id`, `title`, `scenario`, `context_summary`, `message_count`, `status`, `created_at`, `updated_at`.
- `ai_messages`: assistant/user messages, citations, fallback flag, and latency.
  Fields: `_id`, `conversation_id`, `role`, `content`, `model`, `citations`, `fallback_used`, `latency_ms`, `created_at`.

### Workflow, API, Notification, And Audit

- `profile_change_requests`: pending student/teacher editable-profile changes. Admin approval applies the change to `students` or `teachers`.
  Fields: `_id`, `requester_user_id`, `target_type`, `target_id`, `changes`, `status`, `reviewer_user_id`, `review_comment`, `reviewed_at`, `created_at`, `updated_at`.
- `notifications`: user-facing workflow notifications.
  Fields: `_id`, `recipient_user_id`, `title`, `content`, `type`, `related_collection`, `related_id`, `is_read`, `created_at`, `read_at`.
- `api_clients`: third-party API client identities.
  Fields: `_id`, `client_name`, `client_key`, `secret_hash`, `allowed_scopes`, `status`, `created_at`, `updated_at`.
- `api_request_logs`: API call observability.
  Fields: `_id`, `client_id`, `user_id`, `method`, `path`, `status_code`, `latency_ms`, `created_at`.
- `audit_logs`: sensitive operation audit trail.
  Fields: `_id`, `actor_user_id`, `action`, `target_collection`, `target_id`, `before`, `after`, `ip`, `user_agent`, `created_at`.

## Active Indexes

Indexes are defined inside schema JSON files and should be created/imported through the UniCloud console.

- `knowledge_base.keywords_index`: `keywords`.
- `attendance_records.student_course_date_unique`: `student_id`, `course_offering_id`, `attendance_date`.
- `attendance_records.course_date_status_idx`: `course_offering_id`, `attendance_date`, `status`.
- `attendance_records.student_date_idx`: `student_id`, `attendance_date`.
- `leave_requests.student_status_created_idx`: `student_id`, `status`, `created_at`.
- `leave_requests.course_status_date_idx`: `course_offering_id`, `status`, `leave_date`.
- `course_evaluations.token_hash_unique`: `token_hash`.
- `course_evaluations.course_status_submitted_idx`: `course_offering_id`, `status`, `submitted_at`.
- `course_evaluations.teacher_status_idx`: `teacher_ids`, `status`.
- `course_materials.course_updated_idx`: `course_offering_id`, `updated_at`.
- `course_materials.public_course_idx`: `is_public_to_students`, `course_offering_id`.
- `enrollments.student_offering_unique`: `student_id`, `course_offering_id`.
- `enrollments.offering_status_idx`: `course_offering_id`, `status`.
- `profile_change_requests.status_created_idx`: `status`, `created_at`.
- `profile_change_requests.requester_status_idx`: `requester_user_id`, `status`.
- `profile_change_requests.target_status_idx`: `target_type`, `target_id`, `status`.

## Cloud Function Usage

- `auth-login`: reads `users`, `roles`; writes `audit_logs`.
- `get-dashboard-data`: reads profile, course, attendance, leave, evaluation, material, recommendation, alert, and profile-change collections in one batched call.
- `submit-leave`: reads `students`, `course_offerings`, `enrollments`; writes `leave_requests`, `audit_logs`.
- `review-leave`: reads `leave_requests`, `teachers`, `course_offerings`, `class_sessions`, `attendance_records`; writes `leave_requests`, `attendance_records`, `leave_request_sessions`, `audit_logs`.
- `cancel-leave`: restores previous attendance status using `leave_request_sessions`.
- `submit-attendance-checkin`: checks classroom geofence and upserts `attendance_records`.
- `submit-evaluation`: writes anonymous `course_evaluations`, appends local `knowledge_base`, writes `audit_logs`.
- `get-evaluation-summary`: reads evaluations and returns anonymous aggregates.
- `get-course-materials` / `save-course-material`: read/write `course_materials` with role and teacher-ownership checks.
- `submit-profile-change` / `review-profile-change`: submit and approve/reject editable profile fields.
- `ask-assistant`: reads `knowledge_base` and returns a grounded answer or safe fallback.

## Password Rule

- Store only salted one-way password verifiers in `users.password_hash`.
- This PoC import data uses `pbkdf2_sha256` so UniCloud cloud functions can verify passwords with Node.js built-in `crypto`.
- Do not store plain text passwords.
- Forgotten-password flows should create `password_reset_tokens`; they should not recover or reveal the old password.
