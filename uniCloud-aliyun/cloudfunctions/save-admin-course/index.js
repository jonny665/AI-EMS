"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (session.role !== "admin" || !session.userId) {
    return { ok: false, message: "Only administrators can manage courses." };
  }

  const payload = normalizePayload(event);
  if (!payload.courseCode || !payload.courseName || !payload.departmentId || !payload.semesterId || !payload.sectionNo || !payload.teacherIds.length || !payload.capacity) {
    return { ok: false, message: "Course code, name, department, semester, section, teachers, and capacity are required." };
  }

  const [courses, offerings, teachers, departments, semesters, materials] = await Promise.all([
    readCollection("courses"),
    readCollection("course_offerings"),
    readCollection("teachers"),
    readCollection("departments"),
    readCollection("semesters"),
    readCollection("course_materials"),
  ]);

  const courseMap = mapById(courses);
  const offeringMap = mapById(offerings);
  const teacherMap = mapById(teachers);
  const departmentMap = mapById(departments);
  const semesterMap = mapById(semesters);
  const currentOffering = payload.courseOfferingId ? offeringMap.get(payload.courseOfferingId) || null : null;
  const currentCourse = payload.courseId
    ? courseMap.get(payload.courseId) || null
    : currentOffering
      ? courseMap.get(currentOffering.course_id) || null
      : null;

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
    return item.course_id === targetCourseId && item.semester_id === payload.semesterId && item.section_no === payload.sectionNo;
  });
  if (duplicateOffering && !currentOffering) {
    return { ok: false, message: "An offering for the same course, semester, and section already exists." };
  }

  const invalidTeacher = payload.teacherIds.find((teacherId) => !teacherMap.get(teacherId));
  if (invalidTeacher) {
    return { ok: false, message: "One or more selected teachers are invalid." };
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
  savedCourse.department_id = payload.departmentId;
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
  savedOffering.semester_id = payload.semesterId;
  savedOffering.section_no = payload.sectionNo;
  savedOffering.teacher_ids = payload.teacherIds.slice();
  savedOffering.capacity = payload.capacity;
  savedOffering.selection_status = payload.selectionStatus;
  savedOffering.syllabus_url = payload.syllabusUrl;
  savedOffering.updated_at = now;

  if (currentOffering) {
    await db.collection("course_offerings").doc(currentOffering._id).update({
      course_id: savedOffering.course_id,
      semester_id: savedOffering.semester_id,
      section_no: savedOffering.section_no,
      teacher_ids: savedOffering.teacher_ids,
      capacity: savedOffering.capacity,
      selection_status: savedOffering.selection_status,
      syllabus_url: savedOffering.syllabus_url,
      updated_at: savedOffering.updated_at,
    });
  } else {
    const addOffering = await db.collection("course_offerings").add({
      course_id: savedOffering.course_id,
      semester_id: savedOffering.semester_id,
      section_no: savedOffering.section_no,
      teacher_ids: savedOffering.teacher_ids,
      capacity: savedOffering.capacity,
      enrolled_count: 0,
      selection_status: savedOffering.selection_status,
      syllabus_url: savedOffering.syllabus_url,
      created_at: now,
      updated_at: now,
    });
    savedOffering._id = addOffering.id;
    savedOffering.created_at = now;
    savedOffering.enrolled_count = 0;
  }

  const course = buildCourseView({
    course: savedCourse,
    offering: savedOffering,
    teachers,
    departments,
    semesters,
    materials,
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
    description: String(event.description || "").trim(),
    status: normalizeCourseStatus(String(event.status || "active").trim()),
    credits: Number(event.credits || 0),
    courseType: normalizeCourseType(String(event.courseType || "major_required").trim()),
    difficultyLevel: normalizeDifficultyLevel(event.difficultyLevel),
    semesterId: String(event.semesterId || "").trim(),
    sectionNo: String(event.sectionNo || "").trim(),
    teacherIds: normalizeTeacherIds(event.teacherIds),
    capacity: Number(event.capacity || 0),
    selectionStatus: normalizeSelectionStatus(String(event.selectionStatus || "not_started").trim()),
    syllabusUrl: String(event.syllabusUrl || "").trim(),
  };
}

function buildCourseView(input) {
  const course = input.course || {};
  const offering = input.offering || {};
  const teachers = input.teachers || [];
  const departments = input.departments || [];
  const semesters = input.semesters || [];
  const materials = input.materials || [];
  const department = course.department_id ? findById(departments, course.department_id) : null;
  const semester = offering.semester_id ? findById(semesters, offering.semester_id) : null;
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
    sectionNo: offering.section_no || "",
    teacherIds: Array.isArray(offering.teacher_ids) ? offering.teacher_ids.slice() : [],
    teacherNames,
    capacity: Number(offering.capacity || 0),
    enrolledCount: Number(offering.enrolled_count || 0),
    selectionStatus: offering.selection_status || "not_started",
    syllabusUrl: offering.syllabus_url || "",
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
