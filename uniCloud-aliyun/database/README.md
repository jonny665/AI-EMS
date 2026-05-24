下面是每张表的字段清单：

**权限与用户**
- `roles`: `_id`, `code`, `name`, `permissions`, `created_at`, `updated_at`
- `users`: `_id`, `username`, `password_hash`, `role_ids`, `display_name`, `email`, `phone`, `avatar_url`, `status`, `last_login_at`, `created_at`, `updated_at`
- `sso_identities`: `_id`, `user_id`, `provider`, `provider_uid`, `created_at`, `updated_at`

**基础信息**
- `departments`: `_id`, `code`, `name`, `parent_id`, `created_at`, `updated_at`
- `majors`: `_id`, `code`, `name`, `department_id`, `degree_type`, `duration_years`, `created_at`, `updated_at`
- `admin_classes`: `_id`, `code`, `name`, `major_id`, `grade_year`, `counselor_user_id`, `created_at`, `updated_at`
- `students`: `_id`, `user_id`, `student_no`, `name`, `gender`, `major_id`, `admin_class_id`, `enrollment_year`, `training_plan_id`, `photo_url`, `contact`, `family_info`, `status`, `created_at`, `updated_at`
- `teachers`: `_id`, `user_id`, `teacher_no`, `name`, `department_id`, `title`, `research_fields`, `teaching_experience`, `office`, `public_profile`, `status`, `created_at`, `updated_at`
- `guardians`: `_id`, `student_id`, `user_id`, `name`, `relationship`, `phone`, `email`, `receive_alerts`, `created_at`, `updated_at`

**课程与成绩**
- `semesters`: `_id`, `code`, `name`, `start_date`, `end_date`, `is_current`, `created_at`, `updated_at`
- `classrooms`: `_id`, `building`, `room_no`, `name`, `capacity`, `latitude`, `longitude`, `geofence_radius_m`, `created_at`, `updated_at`
- `courses`: `_id`, `course_code`, `name`, `department_id`, `credits`, `course_type`, `difficulty_level`, `description`, `status`, `created_at`, `updated_at`
- `course_prerequisites`: `_id`, `course_id`, `prerequisite_course_id`, `rule_type`, `min_score`, `created_at`
- `course_offerings`: `_id`, `course_id`, `semester_id`, `section_no`, `teacher_ids`, `capacity`, `enrolled_count`, `selection_status`, `syllabus_url`, `created_at`, `updated_at`
- `class_sessions`: `_id`, `course_offering_id`, `classroom_id`, `weekday`, `start_time`, `end_time`, `week_start`, `week_end`, `session_date`, `status`, `created_at`, `updated_at`
- `course_materials`: `_id`, `course_offering_id`, `uploader_user_id`, `title`, `file_url`, `file_type`, `is_public_to_students`, `knowledge_document_id`, `created_at`, `updated_at`
- `enrollments`: `_id`, `student_id`, `course_offering_id`, `status`, `selected_at`, `dropped_at`, `created_at`, `updated_at`
- `grades`: `_id`, `enrollment_id`, `student_id`, `course_offering_id`, `score`, `grade_letter`, `gpa_point`, `credits_earned`, `percentile`, `status`, `published_at`, `created_at`, `updated_at`

**培养计划与推荐**
- `training_plans`: `_id`, `major_id`, `grade_year`, `name`, `total_required_credits`, `status`, `created_at`, `updated_at`
- `plan_requirements`: `_id`, `training_plan_id`, `module_code`, `module_name`, `required_credits`, `course_ids`, `rule`, `created_at`, `updated_at`
- `interest_tags`: `_id`, `code`, `name`, `description`, `created_at`
- `student_interest_tags`: `_id`, `student_id`, `tag_id`, `weight`, `created_at`
- `course_recommendations`: `_id`, `student_id`, `semester_id`, `recommended_course_id`, `recommended_offering_id`, `path_name`, `score`, `reason`, `evidence`, `status`, `created_at`, `updated_at`

**考勤与请假**
- `attendance_records`: `_id`, `student_id`, `course_offering_id`, `class_session_id`, `attendance_date`, `status`, `checkin_at`, `checkin_latitude`, `checkin_longitude`, `distance_to_classroom_m`, `source`, `leave_request_id`, `remark`, `created_at`, `updated_at`
- `leave_requests`: `_id`, `student_id`, `reason_type`, `reason_detail`, `start_at`, `end_at`, `attachment_urls`, `status`, `reviewer_user_id`, `review_comment`, `reviewed_at`, `created_at`, `updated_at`
- `leave_request_sessions`: `_id`, `leave_request_id`, `class_session_id`, `attendance_record_id`, `created_at`
- `academic_alerts`: `_id`, `student_id`, `course_offering_id`, `alert_type`, `severity`, `trigger_rule`, `message`, `assigned_to_user_id`, `status`, `created_at`, `resolved_at`

**评教与 AI**
- `evaluation_tokens`: `_id`, `token_hash`, `course_offering_id`, `expires_at`, `used_at`, `status`, `created_at`
- `course_evaluations`: `_id`, `course_id`, `course_offering_id`, `teacher_ids`, `token_hash`, `scores`, `difficulty_score`, `workload_score`, `feedback_text`, `status`, `submitted_at`, `created_at`, `updated_at`
- `course_evaluation_summaries`: `_id`, `course_id`, `course_offering_id`, `semester_id`, `evaluation_count`, `average_scores`, `positive_tags`, `negative_tags`, `ai_summary`, `knowledge_document_id`, `updated_at`
- `knowledge_documents`: `_id`, `title`, `source_type`, `source_id`, `file_url`, `content_hash`, `visibility_roles`, `status`, `owner_user_id`, `created_at`, `updated_at`
- `knowledge_chunks`: `_id`, `document_id`, `chunk_index`, `content`, `embedding_provider`, `vector_id`, `metadata`, `created_at`, `updated_at`
- `ai_conversations`: `_id`, `user_id`, `title`, `scenario`, `context_summary`, `message_count`, `status`, `created_at`, `updated_at`
- `ai_messages`: `_id`, `conversation_id`, `role`, `content`, `model`, `citations`, `fallback_used`, `latency_ms`, `created_at`

**流程、接口、审计**
- `profile_change_requests`: `_id`, `requester_user_id`, `target_type`, `target_id`, `changes`, `status`, `reviewer_user_id`, `review_comment`, `reviewed_at`, `created_at`, `updated_at`
- `notifications`: `_id`, `recipient_user_id`, `title`, `content`, `type`, `related_collection`, `related_id`, `is_read`, `created_at`, `read_at`
- `api_clients`: `_id`, `client_name`, `client_key`, `secret_hash`, `allowed_scopes`, `status`, `created_at`, `updated_at`
- `api_request_logs`: `_id`, `client_id`, `user_id`, `method`, `path`, `status_code`, `latency_ms`, `created_at`
- `audit_logs`: `_id`, `actor_user_id`, `action`, `target_collection`, `target_id`, `before`, `after`, `ip`, `user_agent`, `created_at`





* 下面是每张表的简要作用:
**用户权限**
- `roles`：定义管理员、教师、学生、辅导员等角色及权限。
- `users`：系统登录账号，保存用户名、密码哈希、角色、联系方式等。
- `sso_identities`：绑定统一身份认证或第三方登录账号。

**基础信息**
- `departments`：学院、系、部门等组织结构。
- `majors`：专业信息，关联所属学院/部门。
- `admin_classes`：行政班信息，关联专业、年级、辅导员。
- `students`：学生基础信息、学号、专业、班级、联系方式等。
- `teachers`：教师基础信息、工号、院系、职称、研究方向等。
- `guardians`：学生家长或监护人信息，用于预警通知。

**课程教学**
- `semesters`：学期信息，如 2026 春季学期。
- `classrooms`：教室信息，包括位置坐标和考勤范围。
- `courses`：课程目录，如课程代码、名称、学分、课程类型。
- `course_prerequisites`：课程先修关系，用于选课限制和推荐。
- `course_offerings`：某学期实际开设的课程班。
- `class_sessions`：具体上课时间、地点、周次，用于课表和考勤。
- `course_materials`：教师上传的教学资料、课件、教学文件。

**选课成绩**
- `enrollments`：学生选课记录，记录选中、退课、完成等状态。
- `grades`：学生课程成绩、绩点、获得学分、排名百分位。

**培养计划**
- `training_plans`：不同专业和年级的培养方案。
- `plan_requirements`：培养方案中的学分模块要求，如通识课、专业课。
- `interest_tags`：兴趣标签，如数据分析、软件工程、人工智能。
- `student_interest_tags`：学生选择的兴趣标签。
- `course_recommendations`：AI 生成的课程或发展方向推荐。

**考勤请假**
- `attendance_records`：每个学生每节课的考勤记录。
- `leave_requests`：学生请假申请和审批状态。
- `leave_request_sessions`：请假申请对应的具体课程时间段。
- `academic_alerts`：学业预警，如缺勤过多、绩点过低、学分不足。

**评教**
- `evaluation_tokens`：匿名评教令牌，保证学生身份和评价内容脱钩。
- `course_evaluations`：学生匿名课程评价，包括评分和文字反馈。
- `course_evaluation_summaries`：课程评价统计结果和 AI 总结。

**AI 知识库**
- `knowledge_documents`：政策文件、FAQ、课程资料、评教摘要等知识来源。
- `knowledge_chunks`：知识文档切片，关联 Pinecone 向量库。
- `ai_conversations`：AI 助手的对话会话。
- `ai_messages`：AI 对话中的每条消息、引用来源和响应信息。

**流程通知与审计**
- `profile_change_requests`：学生或教师修改个人信息的审核申请。
- `notifications`：系统通知，如请假结果、预警、审核提醒。
- `api_clients`：第三方系统 API 接入账号。
- `api_request_logs`：API 调用日志，用于监控和排查问题。
- `audit_logs`：敏感操作审计日志，如审批、改成绩、改权限。