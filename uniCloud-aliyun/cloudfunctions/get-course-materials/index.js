"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (!session.userId || !["student", "teacher", "admin"].includes(session.role)) {
    return { ok: false, message: "Login is required." };
  }

  const [offerings, courses, materials, teachers, students, enrollments] = await Promise.all([
    readCollection("course_offerings"),
    readCollection("courses"),
    readCollection("course_materials"),
    session.role === "teacher" ? readCollection("teachers") : Promise.resolve([]),
    session.role === "student" ? readCollection("students") : Promise.resolve([]),
    session.role === "student" ? readCollection("enrollments") : Promise.resolve([]),
  ]);

  const teacher = session.role === "teacher" ? findByUserId(teachers, session.userId) : null;
  const student = session.role === "student" ? findByUserId(students, session.userId) : null;

  const allowedOfferingIds = resolveAllowedOfferingIds({
    role: session.role,
    sessionUserId: session.userId,
    teacher,
    student,
    offerings,
    enrollments,
  });

  const courseMap = mapById(courses);
  const offeringMap = mapById(offerings);
  const allowedCourses = offerings
    .filter((item) => allowedOfferingIds.has(item._id))
    .map((offering) => buildCourseView(offering, courseMap));

  const visibleMaterials = materials
    .filter((item) => allowedOfferingIds.has(String(item.course_offering_id || item.courseOfferingId || "")))
    .filter((item) => session.role !== "student" || item.is_public_to_students === true)
    .map((item) => buildMaterialView(item, offeringMap, courseMap))
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

  return {
    ok: true,
    data: {
      courses: allowedCourses,
      materials: visibleMaterials,
    },
  };
};

async function readCollection(name, limit = 1000) {
  try {
    const result = await db.collection(name).limit(limit).get();
    return result.data || [];
  } catch (error) {
    console.warn(`[get-course-materials] failed to read ${name}.`, error);
    return [];
  }
}

function findByUserId(rows, userId) {
  const keys = buildUserKeys(userId);
  return (
    rows.find((item) => keys.has(String(item.user_id || item.userId || "").trim())) || null
  );
}

function resolveAllowedOfferingIds({ role, sessionUserId, teacher, student, offerings, enrollments }) {
  if (role === "admin") {
    return new Set(offerings.map((item) => item._id).filter(Boolean));
  }

  if (role === "teacher") {
    const teacherKeys = buildUserKeys(sessionUserId);
    if (teacher) {
      teacherKeys.add(String(teacher._id || "").trim());
      teacherKeys.add(String(teacher.user_id || teacher.userId || "").trim());
    }
    return new Set(
      offerings
        .filter((item) => {
          const ids = Array.isArray(item.teacher_ids) ? item.teacher_ids : [];
          return ids.some((id) => teacherKeys.has(String(id || "").trim()));
        })
        .map((item) => item._id)
        .filter(Boolean),
    );
  }

  const studentIds = buildStudentIdSet(student, sessionUserId);
  return new Set(
    enrollments
      .filter((item) => item.status !== "dropped")
      .filter((item) => studentIds.has(String(item.student_id || item.studentId || "").trim()))
      .map((item) => item.course_offering_id || item.courseOfferingId)
      .filter(Boolean),
  );
}

function buildUserKeys(userId) {
  const value = String(userId || "").trim();
  const keys = new Set(value ? [value] : []);
  addRoleAliases(keys, value, "student", "s");
  addRoleAliases(keys, value, "teacher", "t");
  return keys;
}

function addRoleAliases(keys, value, roleName, roleCode) {
  const legacyPrefix = `u_${roleName}_`;
  const userPrefix = `user_${roleCode}_`;
  const entityPrefix = `${roleName}_`;
  const lower = value.toLowerCase();
  let suffix = "";

  if (lower.startsWith(legacyPrefix)) {
    suffix = value.slice(legacyPrefix.length);
  } else if (lower.startsWith(userPrefix)) {
    suffix = value.slice(userPrefix.length);
  } else if (lower.startsWith(entityPrefix)) {
    suffix = value.slice(entityPrefix.length);
  }

  if (!suffix) {
    return;
  }

  keys.add(`${legacyPrefix}${suffix}`);
  keys.add(`${userPrefix}${suffix}`);
  keys.add(`${entityPrefix}${suffix}`);
}

function buildStudentIdSet(student, sessionUserId) {
  const ids = new Set();
  const add = (value) => {
    const normalized = String(value || "").trim();
    if (normalized) {
      ids.add(normalized);
    }
  };

  add(sessionUserId);
  if (student) {
    add(student._id);
    add(student.user_id || student.userId);
  }

  for (const value of Array.from(ids)) {
    for (const alias of buildUserKeys(value)) {
      add(alias);
    }
  }

  return ids;
}

function buildCourseView(offering, courseMap) {
  const course = courseMap.get(offering.course_id) || {};
  return {
    _id: offering._id,
    courseOfferingId: offering._id,
    courseId: offering.course_id || "",
    code: course.course_code || course.code || "",
    name: course.name || "",
    title: [course.course_code || course.code, course.name].filter(Boolean).join(" ").trim(),
    sectionNo: offering.section_no || "",
    teacherIds: offering.teacher_ids || [],
    capacity: Number(offering.capacity || 0),
    enrolledCount: Number(offering.enrolled_count || 0),
    selectionStatus: offering.selection_status || "",
  };
}

function buildMaterialView(item, offeringMap, courseMap) {
  const offeringId = String(item.course_offering_id || item.courseOfferingId || "");
  const offering = offeringMap.get(offeringId) || {};
  const course = courseMap.get(offering.course_id) || {};
  const courseName = [course.course_code || course.code, course.name].filter(Boolean).join(" ").trim();
  return {
    _id: item._id,
    courseOfferingId: offeringId,
    courseId: offering.course_id || "",
    courseName,
    uploaderUserId: item.uploader_user_id || "",
    title: item.title || "",
    fileUrl: item.file_url || "",
    fileType: item.file_type || "",
    isPublicToStudents: item.is_public_to_students === true,
    knowledgeDocumentId: item.knowledge_document_id || "",
    createdAt: Number(item.created_at || 0),
    updatedAt: Number(item.updated_at || 0),
  };
}

function mapById(items) {
  return new Map(items.filter((item) => item && item._id).map((item) => [item._id, item]));
}
