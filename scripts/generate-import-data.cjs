const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "uniCloud-aliyun", "database", "import");
fs.mkdirSync(outDir, { recursive: true });

const now = 1779595200000;
const day = 24 * 60 * 60 * 1000;

const data = {
  roles: [
    { _id: "role_student", code: "student", name: "Student", permissions: ["dashboard.read.self", "leave.submit", "evaluation.submit", "assistant.ask"], created_at: now, updated_at: now },
    { _id: "role_teacher", code: "teacher", name: "Teacher", permissions: ["dashboard.read.class", "leave.review", "evaluation.read.own", "materials.manage"], created_at: now, updated_at: now },
    { _id: "role_admin", code: "admin", name: "Administrator", permissions: ["system.manage", "profile.review", "leave.review", "evaluation.read.all"], created_at: now, updated_at: now },
    { _id: "role_academic_staff", code: "academic_staff", name: "Academic Staff", permissions: ["academic.manage", "profile.review"], created_at: now, updated_at: now },
    { _id: "role_counselor", code: "counselor", name: "Counselor", permissions: ["alert.read.class", "leave.review"], created_at: now, updated_at: now },
    { _id: "role_guardian", code: "guardian", name: "Guardian", permissions: ["alert.read.child"], created_at: now, updated_at: now },
  ],
  departments: [
    { _id: "dept_cs", code: "CS", name: "Computer Science", parent_id: "", created_at: now, updated_at: now },
    { _id: "dept_academic", code: "AO", name: "Academic Office", parent_id: "", created_at: now, updated_at: now },
  ],
  majors: [
    { _id: "major_se", code: "SE", name: "Software Engineering", department_id: "dept_cs", degree_type: "Bachelor", duration_years: 4, created_at: now, updated_at: now },
    { _id: "major_ai", code: "AI", name: "Artificial Intelligence", department_id: "dept_cs", degree_type: "Bachelor", duration_years: 4, created_at: now, updated_at: now },
  ],
  semesters: [
    { _id: "sem_2026_spring", code: "2026-spring", name: "2026 Spring", start_date: "2026-02-24", end_date: "2026-06-21", is_current: true, created_at: now, updated_at: now },
    { _id: "sem_2026_fall", code: "2026-fall", name: "2026 Fall", start_date: "2026-09-01", end_date: "2027-01-10", is_current: false, created_at: now, updated_at: now },
  ],
  admin_classes: [
    { _id: "class_se_2024_1", code: "SE2024-1", name: "Software Engineering 2024 Class 1", major_id: "major_se", grade_year: 2024, counselor_user_id: "user_t_008", created_at: now, updated_at: now },
  ],
  training_plans: [
    { _id: "tp_se_2024", major_id: "major_se", grade_year: 2024, name: "Software Engineering 2024 Training Plan", total_required_credits: 120, status: "active", created_at: now, updated_at: now },
  ],
  plan_requirements: [
    { _id: "pr_general", training_plan_id: "tp_se_2024", module_code: "general", module_name: "General Education", required_credits: 30, course_ids: ["course_math"], rule: {}, created_at: now, updated_at: now },
    { _id: "pr_major_required", training_plan_id: "tp_se_2024", module_code: "major_required", module_name: "Major Required", required_credits: 45, course_ids: ["course_software_design", "course_database"], rule: {}, created_at: now, updated_at: now },
    { _id: "pr_major_elective", training_plan_id: "tp_se_2024", module_code: "major_elective", module_name: "Major Elective", required_credits: 30, course_ids: ["course_process", "course_data_analysis"], rule: {}, created_at: now, updated_at: now },
    { _id: "pr_practice", training_plan_id: "tp_se_2024", module_code: "practice", module_name: "Practice", required_credits: 15, course_ids: ["course_capstone"], rule: {}, created_at: now, updated_at: now },
  ],
  students: [
    { _id: "student_001", user_id: "user_s_001", student_no: "S2023001", name: "Amy Liu", gender: "female", major_id: "major_se", admin_class_id: "class_se_2024_1", enrollment_year: 2024, training_plan_id: "tp_se_2024", photo_url: "", contact: { email: "s2023001@ai-ems.test", phone: "1370000201", address: "Dorm A-501" }, family_info: { guardianName: "Mary Liu", guardianPhone: "1360000201" }, status: "active", percentile_rank: 82, created_at: now, updated_at: now },
    { _id: "student_002", user_id: "user_s_002", student_no: "S2023002", name: "Ben Zhang", gender: "male", major_id: "major_se", admin_class_id: "class_se_2024_1", enrollment_year: 2024, training_plan_id: "tp_se_2024", photo_url: "", contact: { email: "s2023002@ai-ems.test", phone: "1370000202", address: "Dorm B-406" }, family_info: { guardianName: "Wei Zhang", guardianPhone: "1360000202" }, status: "active", percentile_rank: 35, created_at: now, updated_at: now },
    { _id: "student_003", user_id: "user_s_003", student_no: "S2023003", name: "Chloe Wang", gender: "female", major_id: "major_se", admin_class_id: "class_se_2024_1", enrollment_year: 2024, training_plan_id: "tp_se_2024", photo_url: "", contact: { email: "s2023003@ai-ems.test", phone: "1370000203", address: "Dorm C-301" }, family_info: { guardianName: "Jing Wang", guardianPhone: "1360000203" }, status: "active", percentile_rank: 68, created_at: now, updated_at: now },
  ],
  teachers: [
    { _id: "teacher_001", user_id: "user_t_001", teacher_no: "T1001", name: "Alice Chen", department_id: "dept_cs", title: "Associate Professor", research_fields: ["Software Engineering", "Learning Analytics"], teaching_experience: "10 years of software engineering teaching.", office: "Teaching Building 3-502", public_profile: { officeHours: "Tue 14:00-16:00", homepage: "https://ai-ems.test/teachers/t1001" }, status: "active", created_at: now, updated_at: now },
    { _id: "teacher_002", user_id: "user_t_002", teacher_no: "T1002", name: "Brian Li", department_id: "dept_cs", title: "Lecturer", research_fields: ["Database Systems"], teaching_experience: "Database and data management courses.", office: "Teaching Building 3-503", public_profile: { officeHours: "Thu 10:00-11:30" }, status: "active", created_at: now, updated_at: now },
  ],
  guardians: [
    { _id: "guardian_001", student_id: "student_001", user_id: "", name: "Mary Liu", relationship: "mother", phone: "1360000201", email: "guardian001@ai-ems.test", receive_alerts: true, created_at: now, updated_at: now },
    { _id: "guardian_002", student_id: "student_002", user_id: "", name: "Wei Zhang", relationship: "father", phone: "1360000202", email: "guardian002@ai-ems.test", receive_alerts: true, created_at: now, updated_at: now },
  ],
  courses: [
    { _id: "course_software_design", course_code: "JC3506", name: "Software Design and Implementation", name_en: "Software Design and Implementation", credits: 15, course_type: "major_required", department_id: "dept_cs", difficulty_level: 3, status: "active", created_at: now, updated_at: now },
    { _id: "course_process", course_code: "PM3506", name: "Software Process Management", name_en: "Software Process Management", credits: 15, course_type: "major_elective", department_id: "dept_cs", difficulty_level: 2, status: "active", created_at: now, updated_at: now },
    { _id: "course_data_analysis", course_code: "DA3506", name: "Educational Data Analysis", name_en: "Educational Data Analysis", credits: 12, course_type: "major_elective", department_id: "dept_cs", difficulty_level: 3, status: "active", created_at: now, updated_at: now },
    { _id: "course_database", course_code: "DB2501", name: "Database Principles", name_en: "Database Principles", credits: 12, course_type: "major_required", department_id: "dept_cs", difficulty_level: 3, status: "active", created_at: now, updated_at: now },
    { _id: "course_math", course_code: "MA1001", name: "Discrete Mathematics", name_en: "Discrete Mathematics", credits: 8, course_type: "general", department_id: "dept_cs", difficulty_level: 2, status: "active", created_at: now, updated_at: now },
    { _id: "course_capstone", course_code: "CP4001", name: "Capstone Project", name_en: "Capstone Project", credits: 15, course_type: "practice", department_id: "dept_cs", difficulty_level: 4, status: "active", created_at: now, updated_at: now },
  ],
  course_prerequisites: [
    { _id: "pre_da_db", course_id: "course_data_analysis", prerequisite_course_id: "course_database", rule_type: "recommended", min_score: 60, created_at: now },
    { _id: "pre_capstone_sd", course_id: "course_capstone", prerequisite_course_id: "course_software_design", rule_type: "must_complete", min_score: 60, created_at: now },
  ],
  classrooms: [
    { _id: "room_a101", building: "A", room_no: "101", name: "A101", capacity: 60, latitude: 31.230416, longitude: 121.473701, geofence_radius_m: 50, created_at: now, updated_at: now },
    { _id: "room_b208", building: "B", room_no: "208", name: "B208", capacity: 45, latitude: 31.2306, longitude: 121.4739, geofence_radius_m: 50, created_at: now, updated_at: now },
  ],
  course_offerings: [
    { _id: "offering_sd_2026s", course_id: "course_software_design", semester_id: "sem_2026_spring", major_id: "major_se", training_plan_id: "tp_se_2024", grade_year: 2024, classroom_id: "room_a101", section_no: "01", teacher_ids: ["teacher_001"], capacity: 50, enrolled_count: 32, selection_status: "open", syllabus_url: "https://example.com/sd-syllabus.pdf", course_start_date: "2026-05-25", course_end_date: "2026-06-29", class_weekday: 1, class_start_time: "10:00", class_end_time: "12:00", total_sessions: 6, material_upload_deadline_at: Date.parse("2026-06-29T23:59:59"), created_at: now, updated_at: now },
    { _id: "offering_pm_2026s", course_id: "course_process", semester_id: "sem_2026_spring", major_id: "major_se", training_plan_id: "tp_se_2024", grade_year: 2024, classroom_id: "room_a101", section_no: "01", teacher_ids: ["teacher_001"], capacity: 45, enrolled_count: 28, selection_status: "open", syllabus_url: "https://example.com/pm-syllabus.pdf", course_start_date: "2026-05-27", course_end_date: "2026-07-01", class_weekday: 3, class_start_time: "14:00", class_end_time: "16:00", total_sessions: 6, material_upload_deadline_at: Date.parse("2026-07-01T23:59:59"), created_at: now, updated_at: now },
    { _id: "offering_da_2026s", course_id: "course_data_analysis", semester_id: "sem_2026_spring", major_id: "major_se", training_plan_id: "tp_se_2024", grade_year: 2024, classroom_id: "room_b208", section_no: "01", teacher_ids: ["teacher_001"], capacity: 40, enrolled_count: 22, selection_status: "open", syllabus_url: "https://example.com/da-syllabus.pdf", course_start_date: "2026-05-29", course_end_date: "2026-07-03", class_weekday: 5, class_start_time: "09:00", class_end_time: "11:00", total_sessions: 6, material_upload_deadline_at: Date.parse("2026-07-03T23:59:59"), created_at: now, updated_at: now },
    { _id: "offering_db_2026s", course_id: "course_database", semester_id: "sem_2026_spring", major_id: "major_se", training_plan_id: "tp_se_2024", grade_year: 2024, classroom_id: "room_b208", section_no: "02", teacher_ids: ["teacher_002"], capacity: 55, enrolled_count: 35, selection_status: "closed", syllabus_url: "https://example.com/db-syllabus.pdf", course_start_date: "2026-05-28", course_end_date: "2026-07-02", class_weekday: 4, class_start_time: "10:00", class_end_time: "12:00", total_sessions: 6, material_upload_deadline_at: Date.parse("2026-07-02T23:59:59"), created_at: now, updated_at: now },
  ],
  class_sessions: [
    { _id: "session_sd_0525", course_offering_id: "offering_sd_2026s", classroom_id: "room_a101", weekday: 1, start_time: "10:00", end_time: "12:00", week_start: 1, week_end: 16, session_date: "2026-05-25", status: "scheduled", created_at: now, updated_at: now },
    { _id: "session_pm_0527", course_offering_id: "offering_pm_2026s", classroom_id: "room_a101", weekday: 3, start_time: "14:00", end_time: "16:00", week_start: 1, week_end: 16, session_date: "2026-05-27", status: "scheduled", created_at: now, updated_at: now },
    { _id: "session_da_0529", course_offering_id: "offering_da_2026s", classroom_id: "room_b208", weekday: 5, start_time: "09:00", end_time: "11:00", week_start: 1, week_end: 16, session_date: "2026-05-29", status: "scheduled", created_at: now, updated_at: now },
  ],
  enrollments: [
    { _id: "enroll_s1_sd", student_id: "student_001", course_offering_id: "offering_sd_2026s", status: "enrolled", selected_at: now - 20 * day, created_at: now - 20 * day, updated_at: now - 20 * day },
    { _id: "enroll_s1_pm", student_id: "student_001", course_offering_id: "offering_pm_2026s", status: "enrolled", selected_at: now - 20 * day, created_at: now - 20 * day, updated_at: now - 20 * day },
    { _id: "enroll_s2_sd", student_id: "student_002", course_offering_id: "offering_sd_2026s", status: "enrolled", selected_at: now - 20 * day, created_at: now - 20 * day, updated_at: now - 20 * day },
    { _id: "enroll_s2_pm", student_id: "student_002", course_offering_id: "offering_pm_2026s", status: "enrolled", selected_at: now - 20 * day, created_at: now - 20 * day, updated_at: now - 20 * day },
    { _id: "enroll_s3_sd", student_id: "student_003", course_offering_id: "offering_sd_2026s", status: "enrolled", selected_at: now - 20 * day, created_at: now - 20 * day, updated_at: now - 20 * day },
  ],
  grades: [
    { _id: "grade_s1_programming", student_id: "student_001", course_id: "course_database", course_offering_id: "offering_db_2026s", semester_id: "sem_2026_spring", score: 86, gpa_point: 3.6, credits_earned: 12, status: "published", created_at: now, updated_at: now },
    { _id: "grade_s1_sd", student_id: "student_001", course_id: "course_software_design", course_offering_id: "offering_sd_2026s", semester_id: "sem_2026_spring", score: 91, gpa_point: 3.9, credits_earned: 15, status: "published", created_at: now, updated_at: now },
    { _id: "grade_s2_db", student_id: "student_002", course_id: "course_database", course_offering_id: "offering_db_2026s", semester_id: "sem_2026_spring", score: 58, gpa_point: 0, credits_earned: 0, status: "published", created_at: now, updated_at: now },
  ],
  attendance_records: [
    { _id: "att_s1_sd_0525", student_id: "student_001", course_offering_id: "offering_sd_2026s", class_session_id: "session_sd_0525", attendance_date: "2026-05-25", status: "absent", checkin_at: 0, checkin_latitude: 0, checkin_longitude: 0, distance_to_classroom_m: 0, source: "system_import", leave_request_id: "", remark: "", created_at: now, updated_at: now },
    { _id: "att_s1_pm_0527", student_id: "student_001", course_offering_id: "offering_pm_2026s", class_session_id: "session_pm_0527", attendance_date: "2026-05-27", status: "present", checkin_at: now, checkin_latitude: 31.230416, checkin_longitude: 121.473701, distance_to_classroom_m: 8, source: "location", leave_request_id: "", remark: "", created_at: now, updated_at: now },
    { _id: "att_s2_sd_0511", student_id: "student_002", course_offering_id: "offering_sd_2026s", class_session_id: "session_sd_0525", attendance_date: "2026-05-11", status: "absent", source: "system_import", leave_request_id: "", remark: "Generated test absence", created_at: now - 14 * day, updated_at: now - 14 * day },
    { _id: "att_s2_sd_0518", student_id: "student_002", course_offering_id: "offering_sd_2026s", class_session_id: "session_sd_0525", attendance_date: "2026-05-18", status: "absent", source: "system_import", leave_request_id: "", remark: "Generated test absence", created_at: now - 7 * day, updated_at: now - 7 * day },
    { _id: "att_s2_pm_0527", student_id: "student_002", course_offering_id: "offering_pm_2026s", class_session_id: "session_pm_0527", attendance_date: "2026-05-27", status: "absent", source: "system_import", leave_request_id: "", remark: "Generated test absence", created_at: now, updated_at: now },
  ],
  leave_requests: [
    { _id: "leave_s1_sd_pending", student_id: "student_001", course_offering_id: "offering_sd_2026s", leave_date: "2026-05-25", reason_type: "sick", reason_detail: "Fever and clinic visit.", start_at: now, end_at: now + day - 1, attachment_urls: [], status: "pending", reviewer_user_id: "", review_comment: "", reviewed_at: 0, created_at: now, updated_at: now },
  ],
  leave_request_sessions: [
    { _id: "leave_session_demo", leave_request_id: "leave_s1_sd_pending", class_session_id: "session_sd_0525", attendance_record_id: "att_s1_sd_0525", previous_status: "absent", previous_source: "system_import", created_at: now, updated_at: now },
  ],
  course_evaluations: [
    { _id: "eval_sd_001", course_id: "course_software_design", course_offering_id: "offering_sd_2026s", teacher_ids: ["teacher_001"], token_hash: "sha256$evalsd001", scores: { content: 5, teaching_method: 5, difficulty: 3, workload: 4, achievement: 5, overall: 5 }, difficulty_score: 3, workload_score: 4, feedback_text: "Practical and helpful for real project architecture.", status: "submitted", submitted_at: now - 3 * day, created_at: now - 3 * day, updated_at: now - 3 * day },
    { _id: "eval_da_001", course_id: "course_data_analysis", course_offering_id: "offering_da_2026s", teacher_ids: ["teacher_001"], token_hash: "sha256$evalda001", scores: { content: 5, teaching_method: 4, difficulty: 3, workload: 3, achievement: 4, overall: 4 }, difficulty_score: 3, workload_score: 3, feedback_text: "Good for students interested in data analysis.", status: "submitted", submitted_at: now - 2 * day, created_at: now - 2 * day, updated_at: now - 2 * day },
  ],
  course_evaluation_summaries: [
    { _id: "eval_summary_sd", course_id: "course_software_design", course_offering_id: "offering_sd_2026s", teacher_ids: ["teacher_001"], evaluation_count: 1, average_scores: { content: 5, teaching_method: 5, difficulty: 3, workload: 4, achievement: 5, overall: 5 }, rating_distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 1 }, ai_summary: "Students value the practical project structure.", updated_at: now },
  ],
  evaluation_tokens: [
    { _id: "token_s1_sd", student_id: "student_001", course_offering_id: "offering_sd_2026s", token_hash: "sha256$token_s1_sd", status: "used", issued_at: now - 5 * day, used_at: now - 3 * day, expires_at: now + 30 * day, created_at: now - 5 * day },
  ],
  course_materials: [
    { _id: "material_sd_syllabus", course_offering_id: "offering_sd_2026s", uploader_user_id: "user_t_001", title: "Syllabus and Project Rubric", file_url: "https://example.com/ai-ems/software-design-syllabus.pdf", file_type: "document", is_public_to_students: true, knowledge_document_id: "kdoc_sd_syllabus", created_at: now, updated_at: now },
    { _id: "material_pm_slides", course_offering_id: "offering_pm_2026s", uploader_user_id: "user_t_001", title: "Scrum Sprint Planning Slides", file_url: "https://example.com/ai-ems/process-slides.pdf", file_type: "slide", is_public_to_students: true, knowledge_document_id: "kdoc_pm_slides", created_at: now, updated_at: now },
  ],
  interest_tags: [
    { _id: "tag_data", code: "data_analysis", name: "Data Analysis", description: "Data analysis and learning analytics.", created_at: now },
    { _id: "tag_se", code: "software_engineering", name: "Software Engineering", description: "Software architecture and project delivery.", created_at: now },
    { _id: "tag_ai", code: "artificial_intelligence", name: "Artificial Intelligence", description: "AI applications and model workflows.", created_at: now },
  ],
  student_interest_tags: [
    { _id: "sit_s1_data", student_id: "student_001", tag_id: "tag_data", weight: 1, created_at: now },
    { _id: "sit_s1_se", student_id: "student_001", tag_id: "tag_se", weight: 1, created_at: now },
    { _id: "sit_s2_ai", student_id: "student_002", tag_id: "tag_ai", weight: 1, created_at: now },
  ],
  course_recommendations: [
    { _id: "rec_s1_da", student_id: "student_001", semester_id: "sem_2026_spring", recommended_course_id: "course_data_analysis", recommended_offering_id: "offering_da_2026s", path_name: "Data Analysis Direction", score: 88, reason: "Matches Data Analysis interest tag; evaluation average is 4.0/5; database foundation is present.", evidence: { completed_course_ids: ["course_database"], interest_tags: ["Data Analysis"], evaluation_average: 4 }, status: "new", created_at: now, updated_at: now },
  ],
  academic_alerts: [
    { _id: "alert_s2_absence", student_id: "student_002", course_offering_id: "offering_sd_2026s", alert_type: "absence", severity: "high", trigger_rule: { absentGreaterOrEqual: 3 }, message: "Ben Zhang has 3 absence records and needs counselor follow-up.", assigned_to_user_id: "user_t_008", status: "open", created_at: now, resolved_at: 0 },
  ],
  profile_change_requests: [
    { _id: "pcr_s1_phone", requester_user_id: "user_s_001", target_type: "student", target_id: "student_001", changes: { "contact.phone": { oldValue: "1370000201", newValue: "1370000999", label: "Phone" } }, status: "pending", reviewer_user_id: "", review_comment: "", reviewed_at: 0, created_at: now, updated_at: now },
  ],
  knowledge_documents: [
    { _id: "kdoc_policy_graduation", title: "Graduation Credit Policy", source_type: "policy", source_url: "https://example.com/policies/graduation", owner_user_id: "user_admin_001", status: "published", created_at: now, updated_at: now },
    { _id: "kdoc_sd_syllabus", title: "Software Design Syllabus", source_type: "course_material", source_url: "https://example.com/ai-ems/software-design-syllabus.pdf", owner_user_id: "user_t_001", status: "published", created_at: now, updated_at: now },
  ],
  knowledge_chunks: [
    { _id: "kchunk_grad_001", document_id: "kdoc_policy_graduation", chunk_index: 1, content: "Students should complete required credits across general, major required, major elective and practice modules before graduation.", embedding_provider: "local-keyword", vector_id: "local_grad_001", metadata: { keywords: ["graduation", "credits"] }, created_at: now, updated_at: now },
    { _id: "kchunk_sd_001", document_id: "kdoc_sd_syllabus", chunk_index: 1, content: "Software Design and Implementation emphasizes practical architecture and project delivery.", embedding_provider: "local-keyword", vector_id: "local_sd_001", metadata: { keywords: ["software design", "project"] }, created_at: now, updated_at: now },
  ],
  knowledge_base: [
    { _id: "kb_graduation", title: "Graduation credit requirement", keywords: ["graduation", "credit", "credits", "学分", "毕业"], content: "Students should track total credits, module credits, GPA trend, and remaining required courses before graduation.", category: "policy", createTime: now, updateTime: now },
    { _id: "kb_leave", title: "Leave approval workflow", keywords: ["leave", "absence", "请假", "缺勤", "attendance"], content: "After a leave request is approved, the attendance record for the matching course date is marked as on_leave. Cancelling approved leave restores the previous status.", category: "policy", createTime: now, updateTime: now },
    { _id: "kb_course_selection", title: "Course selection from evaluations", keywords: ["course selection", "evaluation", "feedback", "选课", "评价"], content: "Anonymous evaluation summaries can support course selection. Software Design is practical and Educational Data Analysis fits students interested in analytics.", category: "course", createTime: now, updateTime: now },
  ],
  notifications: [
    { _id: "notice_pcr_s1", user_id: "user_admin_001", title: "Profile change pending", content: "Amy Liu submitted a phone update request.", type: "profile_review", status: "unread", created_at: now, read_at: 0 },
    { _id: "notice_alert_s2", user_id: "user_t_008", title: "Attendance alert", content: "Ben Zhang has 3 absence records.", type: "academic_alert", status: "unread", created_at: now, read_at: 0 },
  ],
  ai_conversations: [
    { _id: "ai_conv_s1_grad", user_id: "user_s_001", title: "Graduation credit requirement", scenario: "graduation_check", context_summary: "What should I check before graduation?", message_count: 2, status: "active", created_at: now - day, updated_at: now - day + 1000 },
    { _id: "ai_conv_t1_eval", user_id: "user_t_001", title: "Course evaluation summary", scenario: "course_selection", context_summary: "What feedback did students give?", message_count: 2, status: "active", created_at: now - day, updated_at: now - day + 2000 },
  ],
  ai_messages: [
    { _id: "ai_msg_s1_001", conversation_id: "ai_conv_s1_grad", role: "user", content: "What should I check before graduation?", model: "", citations: [], fallback_used: false, latency_ms: 0, created_at: now - day },
    { _id: "ai_msg_s1_002", conversation_id: "ai_conv_s1_grad", role: "assistant", content: "Track total credits, module credits, GPA trend, and remaining required courses.", model: "local-keyword-kb", citations: [{ knowledge_base_id: "kb_graduation", title: "Graduation credit requirement" }], fallback_used: false, latency_ms: 36, created_at: now - day + 1000 },
    { _id: "ai_msg_t1_001", conversation_id: "ai_conv_t1_eval", role: "user", content: "What feedback did students give for Software Design?", model: "", citations: [], fallback_used: false, latency_ms: 0, created_at: now - day },
    { _id: "ai_msg_t1_002", conversation_id: "ai_conv_t1_eval", role: "assistant", content: "Students describe Software Design as practical and helpful for project architecture.", model: "local-keyword-kb", citations: [{ knowledge_base_id: "kb_course_selection", title: "Course selection from evaluations" }], fallback_used: false, latency_ms: 42, created_at: now - day + 2000 },
  ],
  sso_identities: [
    { _id: "sso_s1_local", user_id: "user_s_001", provider: "local-sso", provider_uid: "local-sso-s2023001", created_at: now, updated_at: now },
    { _id: "sso_t1_local", user_id: "user_t_001", provider: "local-sso", provider_uid: "local-sso-t1001", created_at: now, updated_at: now },
  ],
  api_clients: [
    { _id: "api_client_seed", client_name: "Integration Client", client_key: "ai_ems_integration_client", secret_hash: "sha256$local", allowed_scopes: ["dashboard.read", "evaluation.read"], status: "active", created_at: now, updated_at: now },
  ],
  api_request_logs: [
    { _id: "api_log_demo_001", client_id: "api_client_demo", user_id: "user_admin_001", method: "GET", path: "/dashboard", status_code: 200, latency_ms: 96, created_at: now },
  ],
  audit_logs: [
    { _id: "audit_seed_login", actor_user_id: "user_admin_001", action: "seed.import", target_collection: "seed_import", target_id: "import_20260529", before: {}, after: { note: "Seed import data generated." }, ip: "", user_agent: "seed-script", created_at: now },
  ],
};

const expectedCollections = fs
  .readdirSync(path.join(__dirname, "..", "uniCloud-aliyun", "database"))
  .filter((name) => name.endsWith(".schema.json"))
  .map((name) => name.replace(".schema.json", ""))
  .filter((name) => !["users", "password_reset_tokens"].includes(name));

for (const collection of expectedCollections) {
  if (!Object.prototype.hasOwnProperty.call(data, collection)) {
    throw new Error(`Missing import data for ${collection}`);
  }
}

for (const [collection, rows] of Object.entries(data)) {
  const file = path.join(outDir, `${collection}.import.json`);
  fs.writeFileSync(file, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
}

console.log(`Generated ${Object.keys(data).length} import files in ${outDir}`);
