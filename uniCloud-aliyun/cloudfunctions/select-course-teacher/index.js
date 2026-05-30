"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (session.role !== "student" || !session.userId) {
    return { ok: false, message: "Only students can select a course teacher." };
  }

  const courseOfferingId = String(event.courseOfferingId || "").trim();
  const teacherId = String(event.teacherId || event.selectedTeacherId || "").trim();
  if (!courseOfferingId || !teacherId) {
    return { ok: false, message: "Course and teacher are required." };
  }

  const [students, offering, teacher] = await Promise.all([
    readCollection("students"),
    findById("course_offerings", courseOfferingId),
    findById("teachers", teacherId),
  ]);
  const student = findByUserId(students, session.userId);
  if (!student) {
    return { ok: false, message: "Student profile was not found." };
  }
  if (!offering) {
    return { ok: false, message: "Course offering was not found." };
  }
  if (!teacher) {
    return { ok: false, message: "Teacher was not found." };
  }

  const teacherIds = Array.isArray(offering.teacher_ids)
    ? offering.teacher_ids.map((item) => String(item || "").trim())
    : [];
  if (!teacherIds.includes(teacherId)) {
    return { ok: false, message: "This teacher is not assigned to the selected course." };
  }
  if (["closed", "cancelled"].includes(String(offering.selection_status || ""))) {
    return { ok: false, message: "Teacher selection is closed for this course." };
  }

  const enrollments = await findEnrollments(courseOfferingId);
  const enrollment = enrollments.find((item) => item.student_id === student._id) || null;
  if (!enrollment) {
    return { ok: false, message: "You are not in the cohort for this course offering." };
  }
  if (enrollment.status === "dropped") {
    return { ok: false, message: "This course has been dropped." };
  }
  const selectedTeacherId = String(enrollment.selected_teacher_id || enrollment.selectedTeacherId || "").trim();
  const selectedTeacherUserId = String(enrollment.selected_teacher_user_id || enrollment.selectedTeacherUserId || "").trim();
  if (selectedTeacherId || selectedTeacherUserId) {
    return { ok: false, message: "Teacher selection is locked after you choose once." };
  }
  const alreadyCounted = enrollment.status === "enrolled";
  const capacity = Number(offering.capacity || 0);
  const selectedCount = countSelectedEnrollments(enrollments);
  if (!alreadyCounted && capacity > 0 && selectedCount >= capacity) {
    return { ok: false, message: "This course has reached capacity and can no longer be selected." };
  }

  const now = Date.now();
  const update = {
    selected_teacher_id: teacher._id,
    selected_teacher_user_id: teacher.user_id || "",
    selected_teacher_name: teacher.name || teacher.teacher_no || teacher._id,
    teacher_selected_at: now,
    status: "enrolled",
    updated_at: now,
  };
  if (!Number(enrollment.selected_at || 0)) {
    update.selected_at = now;
  }

  await db.collection("enrollments").doc(enrollment._id).update(update);
  const offeringUpdate = { updated_at: now };
  if (!alreadyCounted) {
    offeringUpdate.enrolled_count = selectedCount + 1;
  }
  await db.collection("course_offerings").doc(offering._id).update(offeringUpdate);
  await writeAudit("course.teacher.select", session, enrollment._id, enrollment, { ...enrollment, ...update });

  return {
    ok: true,
    data: {
      enrollment: buildEnrollmentView({ ...enrollment, ...update }),
    },
  };
};

async function readCollection(name, limit = 1000) {
  try {
    const result = await db.collection(name).limit(limit).get();
    return result.data || [];
  } catch (error) {
    console.warn(`[select-course-teacher] failed to read ${name}.`, error);
    return [];
  }
}

async function findById(collection, id) {
  try {
    const result = await db.collection(collection).doc(id).get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    console.warn(`[select-course-teacher] ${collection} lookup failed.`, error);
    return null;
  }
}

async function findEnrollment(studentId, courseOfferingId) {
  try {
    const result = await db
      .collection("enrollments")
      .where({ student_id: studentId, course_offering_id: courseOfferingId })
      .limit(1)
      .get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    console.warn("[select-course-teacher] enrollment lookup failed.", error);
    return null;
  }
}

async function findEnrollments(courseOfferingId) {
  try {
    const result = await db
      .collection("enrollments")
      .where({ course_offering_id: courseOfferingId })
      .limit(1000)
      .get();
    return result.data || [];
  } catch (error) {
    console.warn("[select-course-teacher] enrollments lookup failed.", error);
    return [];
  }
}

function hasSelectedTeacher(enrollment) {
  return Boolean(
    String(enrollment && (enrollment.selected_teacher_id || enrollment.selectedTeacherId) || "").trim() ||
    String(enrollment && (enrollment.selected_teacher_user_id || enrollment.selectedTeacherUserId) || "").trim()
  );
}

function countSelectedEnrollments(enrollments) {
  return (enrollments || []).filter((item) =>
    item.status !== "dropped" &&
    (item.status === "enrolled" || hasSelectedTeacher(item)),
  ).length;
}

function findByUserId(rows, userId) {
  const keys = buildUserKeys(userId);
  return rows.find((item) => keys.has(String(item.user_id || item.userId || "").trim())) || null;
}

function buildUserKeys(userId) {
  const value = String(userId || "").trim();
  const keys = new Set(value ? [value] : []);
  addRoleAliases(keys, value, "student", "s");
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

  if (!suffix) return;
  keys.add(`${legacyPrefix}${suffix}`);
  keys.add(`${userPrefix}${suffix}`);
  keys.add(`${entityPrefix}${suffix}`);
}

function buildEnrollmentView(enrollment) {
  return {
    _id: enrollment._id,
    studentId: enrollment.student_id || "",
    courseOfferingId: enrollment.course_offering_id || "",
    status: enrollment.status || "enrolled",
    selectedTeacherId: enrollment.selected_teacher_id || "",
    selectedTeacherUserId: enrollment.selected_teacher_user_id || "",
    selectedTeacherName: enrollment.selected_teacher_name || "",
    teacherSelectedAt: Number(enrollment.teacher_selected_at || 0),
    selectedAt: Number(enrollment.selected_at || 0),
    updatedAt: Number(enrollment.updated_at || 0),
  };
}

async function writeAudit(action, session, targetId, before, after) {
  try {
    await db.collection("audit_logs").add({
      action,
      actor_user_id: session.userId,
      target_collection: "enrollments",
      target_id: targetId,
      before,
      after,
      created_at: Date.now(),
    });
  } catch (error) {
    console.warn("[select-course-teacher] audit write skipped.", error);
  }
}
