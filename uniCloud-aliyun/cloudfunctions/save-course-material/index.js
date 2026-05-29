"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (!session.userId || !["teacher", "admin"].includes(session.role)) {
    return { ok: false, message: "Only teachers or administrators can save course materials." };
  }

  const payload = normalizePayload(event);
  if (!payload.courseOfferingId || !payload.title || !payload.fileUrl) {
    return { ok: false, message: "Course, title, and file URL are required." };
  }

  const offering = await findById("course_offerings", payload.courseOfferingId);
  if (!offering) {
    return { ok: false, message: "Course offering was not found." };
  }

  if (!(await canManageOffering(session, offering))) {
    return { ok: false, message: "You do not have permission to manage this course offering." };
  }

  const now = Date.now();
  const materialData = {
    course_offering_id: payload.courseOfferingId,
    uploader_user_id: session.userId,
    title: payload.title,
    file_url: payload.fileUrl,
    file_type: payload.fileType,
    is_public_to_students: payload.isPublicToStudents,
    knowledge_document_id: payload.knowledgeDocumentId,
    updated_at: now,
  };

  let materialId = payload.materialId;
  let before = null;

  if (materialId) {
    before = await findById("course_materials", materialId);
    if (!before) {
      return { ok: false, message: "Course material was not found." };
    }
    const currentOffering = await findById("course_offerings", before.course_offering_id);
    if (!currentOffering || !(await canManageOffering(session, currentOffering))) {
      return { ok: false, message: "You do not have permission to edit this course material." };
    }
    await db.collection("course_materials").doc(materialId).update(materialData);
  } else {
    const result = await db.collection("course_materials").add({
      ...materialData,
      created_at: now,
    });
    materialId = result.id;
  }

  const saved = { ...before, ...materialData, _id: materialId, created_at: before ? before.created_at : now };
  await writeAudit(payload.materialId ? "course_material.update" : "course_material.create", session, materialId, before, saved);

  return {
    ok: true,
    data: {
      material: buildMaterialView(saved, offering),
    },
  };
};

function normalizePayload(event) {
  return {
    materialId: String(event.materialId || event._id || "").trim(),
    courseOfferingId: String(event.courseOfferingId || "").trim(),
    title: String(event.title || "").trim(),
    fileUrl: String(event.fileUrl || "").trim(),
    fileType: String(event.fileType || "").trim(),
    isPublicToStudents: event.isPublicToStudents !== false,
    knowledgeDocumentId: String(event.knowledgeDocumentId || "").trim(),
  };
}

async function canManageOffering(session, offering) {
  if (session.role === "admin") {
    return true;
  }

  const teacher = await findByField("teachers", "user_id", session.userId);
  return Boolean(teacher && Array.isArray(offering.teacher_ids) && offering.teacher_ids.includes(teacher._id));
}

async function findById(collection, id) {
  try {
    const result = await db.collection(collection).doc(id).get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    console.warn(`[save-course-material] ${collection} lookup failed.`, error);
    return null;
  }
}

async function findByField(collection, field, value) {
  try {
    const result = await db.collection(collection).where({ [field]: value }).limit(1).get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    console.warn(`[save-course-material] ${collection} lookup failed.`, error);
    return null;
  }
}

function buildMaterialView(item, offering) {
  return {
    _id: item._id,
    courseOfferingId: item.course_offering_id || "",
    courseId: offering.course_id || "",
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

async function writeAudit(action, session, targetId, before, after) {
  try {
    await db.collection("audit_logs").add({
      action,
      actor_user_id: session.userId,
      target_collection: "course_materials",
      target_id: targetId,
      before,
      after,
      created_at: Date.now(),
    });
  } catch (error) {
    console.warn("[save-course-material] audit write skipped.", error);
  }
}
