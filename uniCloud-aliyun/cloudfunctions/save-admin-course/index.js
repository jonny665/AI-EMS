"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (session.role !== "admin" || !session.userId) {
    return { ok: false, message: "Only administrators can manage courses." };
  }

  const payload = normalizePayload(event);
  if (!payload.courseCode || !payload.courseName || !payload.majorId || !payload.sectionNo || !payload.teacherIds.length || !payload.capacity || !payload.gradeYear || !payload.classroomId || !payload.courseStartDate || !payload.courseEndDate || !payload.classStartTime || !payload.classEndTime || !payload.totalSessions) {
    return { ok: false, message: "Course code, major, cohort year, classroom, teachers, dates, class time, total sessions, and capacity are required." };
  }

  const [courses, offerings, teachers, departments, semesters, materials, trainingPlans, majors, students, enrollments, classSessions, classrooms] = await Promise.all([
    readCollection("courses"),
    readCollection("course_offerings"),
    readCollection("teachers"),
    readCollection("departments"),
    readCollection("semesters"),
    readCollection("course_materials"),
    readCollection("training_plans"),
    readCollection("majors"),
    readCollection("students"),
    readCollection("enrollments"),
    readCollection("class_sessions"),
    readCollection("classrooms"),
  ]);

  const courseMap = mapById(courses);
  const offeringMap = mapById(offerings);
  const teacherMap = mapById(teachers);
  const departmentMap = mapById(departments);
  const semesterMap = mapById(semesters);
  const trainingPlanMap = mapById(trainingPlans);
  const majorMap = mapById(majors);
  const classroomMap = mapById(classrooms);
  const currentOffering = payload.courseOfferingId ? offeringMap.get(payload.courseOfferingId) || null : null;
  const currentCourse = payload.courseId
    ? courseMap.get(payload.courseId) || null
    : currentOffering
      ? courseMap.get(currentOffering.course_id) || null
      : null;
  const resolvedSemester = resolveSemester(semesters, currentOffering && currentOffering.semester_id ? currentOffering.semester_id : payload.semesterId);
  const resolvedSemesterId = resolvedSemester ? String(resolvedSemester._id || "").trim() : "";
  if (!resolvedSemesterId) {
    return { ok: false, message: "No semester is available to assign the course." };
  }

  const compareCourseId = currentCourse ? currentCourse._id : currentOffering ? currentOffering.course_id : "";
  const duplicateCourse = courses.find((item) => item.course_code === payload.courseCode && item._id !== compareCourseId);
  if (duplicateCourse && !currentCourse) {
    return { ok: false, message: "Course code already exists." };
  }

  const compareOfferingId = currentOffering ? currentOffering._id : "";
  const targetCourseId = currentCourse ? currentCourse._id : currentOffering ? currentOffering.course_id : payload.courseId || "";
  const duplicateOffering = offerings.find((item) => {
    if (item._id === compareOfferingId) {
      return false;
    }
    return item.course_id === targetCourseId && item.semester_id === resolvedSemesterId && item.section_no === payload.sectionNo;
  });
  if (duplicateOffering && !currentOffering) {
    return { ok: false, message: "An offering for the same course, semester, and section already exists." };
  }

  const invalidTeacher = payload.teacherIds.find((teacherId) => !teacherMap.get(teacherId));
  if (invalidTeacher) {
    return { ok: false, message: "One or more selected teachers are invalid." };
  }
  const major = majorMap.get(payload.majorId);
  if (!major) {
    return { ok: false, message: "Major was not found." };
  }
  const departmentId = String(major.department_id || major.departmentId || payload.departmentId || "").trim();
  if (!departmentId) {
    return { ok: false, message: "Selected major is missing a department." };
  }
  const inferredTrainingPlan = trainingPlans.find((item) =>
    item.major_id === payload.majorId &&
    Number(item.grade_year || 0) === Number(payload.gradeYear || 0) &&
    (!item.status || item.status === "active"),
  ) || null;
  const trainingPlan = payload.trainingPlanId ? trainingPlanMap.get(payload.trainingPlanId) : inferredTrainingPlan;
  if (payload.trainingPlanId && (!trainingPlan || trainingPlan.major_id !== payload.majorId || Number(trainingPlan.grade_year || 0) !== Number(payload.gradeYear || 0))) {
    return { ok: false, message: "Training plan must match the selected major and cohort year." };
  }
  const classroom = classroomMap.get(payload.classroomId);
  if (!classroom) {
    return { ok: false, message: "Classroom was not found." };
  }

  const now = Date.now();
  const before = currentOffering ? clone(currentOffering) : currentCourse ? clone(currentCourse) : null;

  const savedCourse = currentCourse
    ? clone(currentCourse)
    : {
        _id: "",
        created_at: now,
      };
  savedCourse.course_code = payload.courseCode;
  savedCourse.name = payload.courseName;
  savedCourse.department_id = departmentId;
  savedCourse.credits = payload.credits;
  savedCourse.course_type = payload.courseType;
  savedCourse.difficulty_level = payload.difficultyLevel;
  savedCourse.description = payload.description;
  savedCourse.status = payload.status;
  savedCourse.updated_at = now;

  if (currentCourse) {
    await db.collection("courses").doc(currentCourse._id).update({
      course_code: savedCourse.course_code,
      name: savedCourse.name,
      department_id: savedCourse.department_id,
      credits: savedCourse.credits,
      course_type: savedCourse.course_type,
      difficulty_level: savedCourse.difficulty_level,
      description: savedCourse.description,
      status: savedCourse.status,
      updated_at: savedCourse.updated_at,
    });
  } else {
    const addCourse = await db.collection("courses").add({
      course_code: savedCourse.course_code,
      name: savedCourse.name,
      department_id: savedCourse.department_id,
      credits: savedCourse.credits,
      course_type: savedCourse.course_type,
      difficulty_level: savedCourse.difficulty_level,
      description: savedCourse.description,
      status: savedCourse.status,
      created_at: now,
      updated_at: now,
    });
    savedCourse._id = addCourse.id;
    savedCourse.created_at = now;
  }

  const savedOffering = currentOffering
    ? clone(currentOffering)
    : {
        _id: "",
        created_at: now,
        enrolled_count: 0,
      };
  savedOffering.course_id = savedCourse._id || targetCourseId;
  savedOffering.semester_id = resolvedSemesterId;
  savedOffering.major_id = payload.majorId;
  savedOffering.training_plan_id = trainingPlan ? trainingPlan._id : "";
  savedOffering.grade_year = payload.gradeYear || Number(trainingPlan && trainingPlan.grade_year || 0);
  savedOffering.classroom_id = payload.classroomId;
  savedOffering.section_no = payload.sectionNo;
  savedOffering.teacher_ids = payload.teacherIds.slice();
  savedOffering.capacity = payload.capacity;
  savedOffering.selection_status = payload.selectionStatus;
  savedOffering.syllabus_url = payload.syllabusUrl;
  savedOffering.course_start_date = payload.courseStartDate;
  savedOffering.course_end_date = payload.courseEndDate;
  savedOffering.class_weekday = payload.classWeekday;
  savedOffering.class_start_time = payload.classStartTime;
  savedOffering.class_end_time = payload.classEndTime;
  savedOffering.total_sessions = payload.totalSessions;
  savedOffering.material_upload_deadline_at = buildDateTime(payload.courseEndDate, "23:59");
  savedOffering.updated_at = now;

  if (currentOffering) {
    await db.collection("course_offerings").doc(currentOffering._id).update({
      course_id: savedOffering.course_id,
      semester_id: savedOffering.semester_id,
      major_id: savedOffering.major_id,
      training_plan_id: savedOffering.training_plan_id,
      grade_year: savedOffering.grade_year,
      classroom_id: savedOffering.classroom_id,
      section_no: savedOffering.section_no,
      teacher_ids: savedOffering.teacher_ids,
      capacity: savedOffering.capacity,
      selection_status: savedOffering.selection_status,
      syllabus_url: savedOffering.syllabus_url,
      course_start_date: savedOffering.course_start_date,
      course_end_date: savedOffering.course_end_date,
      class_weekday: savedOffering.class_weekday,
      class_start_time: savedOffering.class_start_time,
      class_end_time: savedOffering.class_end_time,
      total_sessions: savedOffering.total_sessions,
      material_upload_deadline_at: savedOffering.material_upload_deadline_at,
      updated_at: savedOffering.updated_at,
    });
  } else {
    const addOffering = await db.collection("course_offerings").add({
      course_id: savedOffering.course_id,
      semester_id: savedOffering.semester_id,
      major_id: savedOffering.major_id,
      training_plan_id: savedOffering.training_plan_id,
      grade_year: savedOffering.grade_year,
      classroom_id: savedOffering.classroom_id,
      section_no: savedOffering.section_no,
      teacher_ids: savedOffering.teacher_ids,
      capacity: savedOffering.capacity,
      enrolled_count: 0,
      selection_status: savedOffering.selection_status,
      syllabus_url: savedOffering.syllabus_url,
      course_start_date: savedOffering.course_start_date,
      course_end_date: savedOffering.course_end_date,
      class_weekday: savedOffering.class_weekday,
      class_start_time: savedOffering.class_start_time,
      class_end_time: savedOffering.class_end_time,
      total_sessions: savedOffering.total_sessions,
      material_upload_deadline_at: savedOffering.material_upload_deadline_at,
      created_at: now,
      updated_at: now,
    });
    savedOffering._id = addOffering.id;
    savedOffering.created_at = now;
    savedOffering.enrolled_count = 0;
  }

  await replaceClassSessions(savedOffering, classSessions, now);
  const enrollmentCount = await enrollCohortStudents(savedOffering, students, enrollments, now);
  savedOffering.enrolled_count = enrollmentCount;
  await db.collection("course_offerings").doc(savedOffering._id).update({
    enrolled_count: enrollmentCount,
    updated_at: now,
  });

  const course = buildCourseView({
    course: savedCourse,
    offering: savedOffering,
    teachers,
    departments,
    semesters,
    majors,
    materials,
    classrooms,
  });
  await writeAudit(currentOffering || currentCourse ? "admin.course.update" : "admin.course.create", session, savedOffering._id, before, course);

  return {
    ok: true,
    data: {
      course,
    },
  };
};

async function readCollection(name, limit = 1000) {
  try {
    const result = await db.collection(name).limit(limit).get();
    return result.data || [];
  } catch (error) {
    console.warn(`[save-admin-course] failed to read ${name}.`, error);
    return [];
  }
}

function normalizePayload(event) {
  return {
    courseId: String(event.courseId || "").trim(),
    courseOfferingId: String(event.courseOfferingId || "").trim(),
    courseCode: String(event.courseCode || event.code || "").trim(),
    courseName: String(event.courseName || event.name || "").trim(),
    departmentId: String(event.departmentId || "").trim(),
    majorId: String(event.majorId || event.major_id || "").trim(),
    description: String(event.description || "").trim(),
    status: normalizeCourseStatus(String(event.status || "active").trim()),
    credits: Number(event.credits || 0),
    courseType: normalizeCourseType(String(event.courseType || "major_required").trim()),
    difficultyLevel: normalizeDifficultyLevel(event.difficultyLevel),
    semesterId: String(event.semesterId || "").trim(),
    trainingPlanId: String(event.trainingPlanId || event.training_plan_id || "").trim(),
    gradeYear: Number(event.gradeYear || event.grade_year || 0),
    classroomId: String(event.classroomId || event.classroom_id || "").trim(),
    sectionNo: String(event.sectionNo || "").trim(),
    teacherIds: normalizeTeacherIds(event.teacherIds),
    capacity: Number(event.capacity || 0),
    selectionStatus: normalizeSelectionStatus(String(event.selectionStatus || "not_started").trim()),
    syllabusUrl: String(event.syllabusUrl || "").trim(),
    courseStartDate: String(event.courseStartDate || event.startDate || "").trim(),
    courseEndDate: String(event.courseEndDate || event.endDate || "").trim(),
    classWeekday: normalizeWeekday(event.classWeekday || event.weekday),
    classStartTime: String(event.classStartTime || event.startTime || "").trim(),
    classEndTime: String(event.classEndTime || event.endTime || "").trim(),
    totalSessions: Number(event.totalSessions || 0),
  };
}

function buildCourseView(input) {
  const course = input.course || {};
  const offering = input.offering || {};
  const teachers = input.teachers || [];
  const departments = input.departments || [];
  const semesters = input.semesters || [];
  const majors = input.majors || [];
  const materials = input.materials || [];
  const classrooms = input.classrooms || [];
  const department = course.department_id ? findById(departments, course.department_id) : null;
  const semester = offering.semester_id ? findById(semesters, offering.semester_id) : null;
  const major = offering.major_id ? findById(majors, offering.major_id) : null;
  const classroom = offering.classroom_id ? findById(classrooms, offering.classroom_id) : null;
  const teacherNames = (offering.teacher_ids || [])
    .map((teacherId) => findById(teachers, teacherId))
    .filter(Boolean)
    .map((teacher) => {
      const user = teacher.user_id ? null : null;
      return teacher.name || teacher.teacher_no || teacher._id;
    });
  const materialCount = materials.filter((item) => item.course_offering_id === offering._id).length;

  return {
    _id: offering._id || course._id || "",
    courseId: course._id || offering.course_id || "",
    courseOfferingId: offering._id || "",
    courseCode: course.course_code || "",
    courseName: course.name || "",
    departmentId: course.department_id || "",
    departmentName: department ? department.name || department.code || department._id : "",
    description: course.description || "",
    status: course.status || "active",
    credits: Number(course.credits || 0),
    courseType: course.course_type || "",
    difficultyLevel: Number(course.difficulty_level || 0),
    semesterId: offering.semester_id || "",
    semesterName: semester ? semester.name || semester.term || semester.code || semester._id : "",
    majorId: offering.major_id || "",
    majorName: major ? major.name || major.code || major._id : "",
    trainingPlanId: offering.training_plan_id || "",
    gradeYear: Number(offering.grade_year || 0),
    classroomId: offering.classroom_id || "",
    classroomName: classroom ? classroom.name || [classroom.building, classroom.room_no].filter(Boolean).join("-") || classroom._id : "",
    sectionNo: offering.section_no || "",
    teacherIds: Array.isArray(offering.teacher_ids) ? offering.teacher_ids.slice() : [],
    teacherNames,
    capacity: Number(offering.capacity || 0),
    enrolledCount: Number(offering.enrolled_count || 0),
    selectionStatus: offering.selection_status || "not_started",
    syllabusUrl: offering.syllabus_url || "",
    startDate: offering.course_start_date || "",
    endDate: offering.course_end_date || "",
    classWeekday: Number(offering.class_weekday || 0),
    classStartTime: offering.class_start_time || "",
    classEndTime: offering.class_end_time || "",
    totalSessions: Number(offering.total_sessions || 0),
    materialUploadDeadlineAt: Number(offering.material_upload_deadline_at || 0),
    materialCount,
    createdAt: Number(offering.created_at || 0),
    updatedAt: Number(offering.updated_at || 0),
  };
}

function normalizeCourseStatus(status) {
  const allowed = ["active", "inactive"];
  return allowed.includes(status) ? status : "active";
}

function normalizeCourseType(courseType) {
  const allowed = ["general", "major_required", "major_elective", "public_elective", "practice"];
  return allowed.includes(courseType) ? courseType : "major_required";
}

function normalizeSelectionStatus(selectionStatus) {
  const allowed = ["not_started", "open", "closed", "cancelled"];
  return allowed.includes(selectionStatus) ? selectionStatus : "not_started";
}

function normalizeDifficultyLevel(value) {
  const level = Number(value || 0);
  if (!Number.isFinite(level)) {
    return 1;
  }
  return Math.max(1, Math.min(5, Math.round(level)));
}

function normalizeWeekday(value) {
  const weekday = Number(value || 0);
  if (!Number.isFinite(weekday)) {
    return 1;
  }
  return Math.max(1, Math.min(7, Math.round(weekday)));
}

function buildDateTime(date, time) {
  const timestamp = Date.parse(`${date}T${time}:00`);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function resolveSemester(semesters, preferredSemesterId) {
  const preferredId = String(preferredSemesterId || "").trim();
  if (preferredId) {
    const preferredSemester = semesters.find((item) => String(item._id || "") === preferredId);
    if (preferredSemester) {
      return preferredSemester;
    }
  }

  const currentSemester = semesters.find((item) => item.is_current || item.isCurrent);
  if (currentSemester) {
    return currentSemester;
  }

  const now = Date.now();
  const activeSemester = semesters.find((item) => {
    const start = Date.parse(`${item.start_date || item.startDate || ""}T00:00:00`);
    const end = Date.parse(`${item.end_date || item.endDate || ""}T23:59:59`);
    return Number.isFinite(start) && Number.isFinite(end) && start <= now && now <= end;
  });
  if (activeSemester) {
    return activeSemester;
  }

  return semesters[0] || null;
}

async function replaceClassSessions(offering, existingSessions, now) {
  const oldSessions = existingSessions.filter((item) => item.course_offering_id === offering._id);
  for (const session of oldSessions) {
    await db.collection("class_sessions").doc(session._id).remove();
  }
  const sessions = generateClassSessions(offering, now);
  for (const session of sessions) {
    await db.collection("class_sessions").add(session);
  }
  return sessions;
}

function generateClassSessions(offering, now) {
  const first = new Date(`${offering.course_start_date}T00:00:00`);
  const end = new Date(`${offering.course_end_date}T23:59:59`);
  if (Number.isNaN(first.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }
  const jsTarget = Number(offering.class_weekday || 1) % 7;
  while (first.getDay() !== jsTarget) {
    first.setDate(first.getDate() + 1);
  }
  const sessions = [];
  for (let index = 0; index < Number(offering.total_sessions || 0); index += 1) {
    const date = new Date(first.getTime() + index * 7 * 24 * 60 * 60 * 1000);
    if (date.getTime() > end.getTime()) {
      break;
    }
    const sessionDate = date.toISOString().slice(0, 10);
    sessions.push({
      course_offering_id: offering._id,
      classroom_id: offering.classroom_id || "",
      weekday: Number(offering.class_weekday || 1),
      start_time: offering.class_start_time,
      end_time: offering.class_end_time,
      week_start: 1,
      week_end: Number(offering.total_sessions || 0),
      sequence_no: index + 1,
      session_date: sessionDate,
      session_start_at: buildDateTime(sessionDate, offering.class_start_time),
      session_end_at: buildDateTime(sessionDate, offering.class_end_time),
      status: "scheduled",
      created_at: now,
      updated_at: now,
    });
  }
  return sessions;
}

async function enrollCohortStudents(offering, students, enrollments, now) {
  const cohortStudents = students.filter((student) => studentMatchesOffering(student, offering));
  let count = countSelectedEnrollments(enrollments.filter((item) => item.course_offering_id === offering._id));
  for (const student of cohortStudents) {
    const existing = enrollments.find((item) => item.student_id === student._id && item.course_offering_id === offering._id);
    if (existing) {
      if (existing.status === "dropped") {
        await db.collection("enrollments").doc(existing._id).update({ status: "selected", updated_at: now });
      }
      continue;
    }
    await db.collection("enrollments").add({
      student_id: student._id,
      course_offering_id: offering._id,
      status: "selected",
      selected_at: now,
      created_at: now,
      updated_at: now,
    });
  }
  return count;
}

function studentMatchesOffering(student, offering) {
  if (!student || !offering) return false;
  const sameYear = offering.grade_year && Number(student.enrollment_year || 0) === Number(offering.grade_year);
  const sameMajor = offering.major_id && student.major_id === offering.major_id;
  if (offering.major_id) {
    return Boolean(sameYear && sameMajor);
  }
  return Boolean(
    (offering.training_plan_id && student.training_plan_id === offering.training_plan_id) ||
    sameYear,
  );
}

function countSelectedEnrollments(enrollments) {
  return (enrollments || []).filter((item) =>
    item.status !== "dropped" &&
    (
      item.status === "enrolled" ||
      String(item.selected_teacher_id || item.selectedTeacherId || "").trim() ||
      String(item.selected_teacher_user_id || item.selectedTeacherUserId || "").trim()
    ),
  ).length;
}

function normalizeTeacherIds(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item || "").trim()).filter(Boolean)));
  }
  return Array.from(
    new Set(
      String(value || "")
        .split(/[;,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function mapById(items) {
  return new Map((items || []).filter((item) => item && item._id).map((item) => [item._id, item]));
}

function findById(items, id) {
  for (const item of items || []) {
    if (item && item._id === id) {
      return item;
    }
  }
  return null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function writeAudit(action, session, targetId, before, after) {
  try {
    await db.collection("audit_logs").add({
      action,
      actor_user_id: session.userId,
      target_collection: "course_offerings",
      target_id: targetId,
      before,
      after,
      created_at: Date.now(),
    });
  } catch (error) {
    console.warn("[save-admin-course] audit write skipped.", error);
  }
}
