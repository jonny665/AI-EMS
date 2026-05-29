"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (!session.userId || !["student", "teacher", "admin"].includes(session.role)) {
    return { ok: false, message: "Login is required." };
  }

  const [teachers, students, offerings, courses, enrollments, materials] = await Promise.all([
    readCollection("teachers"),
    readCollection("students"),
    readCollection("course_offerings"),
    readCollection("courses"),
    readCollection("enrollments"),
    readCollection("course_materials"),
  ]);

  const currentTeacher = teachers.find((item) => item.user_id === session.userId) || null;
  const currentStudent = students.find((item) => item.user_id === session.userId) || null;
  const courseMap = mapById(courses);
  const offeringMap = mapById(offerings);
  const allowedOfferingIds = resolveAllowedOfferingIds({
    role: session.role,
    currentTeacher,
    currentStudent,
    offerings,
    enrollments,
  });

  const allowedCourses = offerings
    .filter((item) => allowedOfferingIds.includes(item._id))
    .map((offering) => buildCourseView(offering, courseMap));

  const visibleMaterials = materials
    .filter((item) => allowedOfferingIds.includes(item.course_offering_id))
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

function resolveAllowedOfferingIds({ role, currentTeacher, currentStudent, offerings, enrollments }) {
  if (role === "admin") {
    return unique(offerings.map((item) => item._id));
  }

  if (role === "teacher") {
    if (!currentTeacher) {
      return [];
    }
    return unique(
      offerings
        .filter((item) => Array.isArray(item.teacher_ids) && item.teacher_ids.includes(currentTeacher._id))
        .map((item) => item._id),
    );
  }

  if (!currentStudent) {
    return [];
  }

  return unique(
    enrollments
      .filter((item) => item.student_id === currentStudent._id && item.status !== "dropped")
      .map((item) => item.course_offering_id),
  );
}

function buildCourseView(offering, courseMap) {
  const course = courseMap.get(offering.course_id) || {};
  return {
    _id: offering._id,
    courseOfferingId: offering._id,
    courseId: offering.course_id || "",
    code: course.course_code || "",
    name: course.name || "",
    title: [course.course_code, course.name].filter(Boolean).join(" ").trim(),
    sectionNo: offering.section_no || "",
    teacherIds: offering.teacher_ids || [],
    capacity: Number(offering.capacity || 0),
    enrolledCount: Number(offering.enrolled_count || 0),
    selectionStatus: offering.selection_status || "",
  };
}

function buildMaterialView(item, offeringMap, courseMap) {
  const offering = offeringMap.get(item.course_offering_id) || {};
  const course = courseMap.get(offering.course_id) || {};
  const courseName = [course.course_code, course.name].filter(Boolean).join(" ").trim();
  return {
    _id: item._id,
    courseOfferingId: item.course_offering_id || "",
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

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
