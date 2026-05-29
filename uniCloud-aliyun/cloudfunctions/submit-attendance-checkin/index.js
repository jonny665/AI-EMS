"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (session.role !== "student" || !session.userId) {
    return { ok: false, message: "Only students can check in." };
  }

  const courseOfferingId = String(event.courseOfferingId || event.courseId || "").trim();
  const latitude = Number(event.latitude);
  const longitude = Number(event.longitude);
  const attendanceDate = String(event.attendanceDate || event.date || new Date().toISOString().slice(0, 10));

  if (!courseOfferingId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, message: "Course and location coordinates are required." };
  }

  const student = await findByField("students", "user_id", session.userId);
  if (!student) {
    return { ok: false, message: "Student profile was not found." };
  }

  const enrollment = await findEnrollment(student._id, courseOfferingId);
  if (!enrollment) {
    return { ok: false, message: "You are not enrolled in this course offering." };
  }

  const offering = await findById("course_offerings", courseOfferingId);
  if (!offering) {
    return { ok: false, message: "Course offering was not found." };
  }

  const classSession = await resolveClassSession(courseOfferingId, attendanceDate);
  const classroom = classSession && classSession.classroom_id ? await findById("classrooms", classSession.classroom_id) : null;
  const geofence = buildGeofence(classroom);
  const distance = distanceMeters(latitude, longitude, geofence.latitude, geofence.longitude);
  const withinGeofence = distance <= geofence.radius;
  const now = Date.now();
  const existing = await findAttendance(student._id, courseOfferingId, attendanceDate);
  const payload = {
    student_id: student._id,
    course_offering_id: courseOfferingId,
    class_session_id: classSession ? classSession._id : `${courseOfferingId}_${attendanceDate}`,
    attendance_date: attendanceDate,
    status: withinGeofence ? "present" : "absent",
    checkin_at: now,
    checkin_latitude: latitude,
    checkin_longitude: longitude,
    distance_to_classroom_m: Math.round(distance),
    source: "location",
    remark: withinGeofence ? "" : "Outside classroom geofence.",
    updated_at: now,
  };

  let attendanceId = "";
  if (existing) {
    attendanceId = existing._id;
    await db.collection("attendance_records").doc(existing._id).update(payload);
  } else {
    const result = await db.collection("attendance_records").add({
      ...payload,
      leave_request_id: "",
      created_at: now,
    });
    attendanceId = result.id;
  }

  await writeAudit("attendance.checkin", session, attendanceId, existing, payload);

  return {
    ok: true,
    data: {
      attendance: {
        _id: attendanceId,
        studentId: student._id,
        courseOfferingId,
        date: attendanceDate,
        status: payload.status,
        source: payload.source,
        distanceToClassroomM: payload.distance_to_classroom_m,
        checkinAt: payload.checkin_at,
      },
      withinGeofence,
      distanceMeters: payload.distance_to_classroom_m,
      radiusMeters: geofence.radius,
    },
  };
};

async function resolveClassSession(courseOfferingId, attendanceDate) {
  const exact = await db
    .collection("class_sessions")
    .where({ course_offering_id: courseOfferingId, session_date: attendanceDate })
    .limit(1)
    .get();
  if (exact.data && exact.data[0]) {
    return exact.data[0];
  }

  const fallback = await db
    .collection("class_sessions")
    .where({ course_offering_id: courseOfferingId })
    .limit(1)
    .get();
  return fallback.data && fallback.data[0] ? fallback.data[0] : null;
}

function buildGeofence(classroom) {
  return {
    latitude: Number(classroom && classroom.latitude) || 31.230416,
    longitude: Number(classroom && classroom.longitude) || 121.473701,
    radius: Number(classroom && classroom.geofence_radius_m) || 50,
  };
}

async function findEnrollment(studentId, courseOfferingId) {
  const result = await db
    .collection("enrollments")
    .where({ student_id: studentId, course_offering_id: courseOfferingId })
    .limit(1)
    .get();
  const row = result.data && result.data[0];
  return row && row.status !== "dropped" ? row : null;
}

async function findAttendance(studentId, courseOfferingId, attendanceDate) {
  const result = await db
    .collection("attendance_records")
    .where({
      student_id: studentId,
      course_offering_id: courseOfferingId,
      attendance_date: attendanceDate,
    })
    .limit(1)
    .get();
  return result.data && result.data[0] ? result.data[0] : null;
}

async function findById(collection, id) {
  try {
    const result = await db.collection(collection).doc(id).get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    console.warn(`[submit-attendance-checkin] ${collection} lookup failed.`, error);
    return null;
  }
}

async function findByField(collection, field, value) {
  try {
    const result = await db.collection(collection).where({ [field]: value }).limit(1).get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    console.warn(`[submit-attendance-checkin] ${collection} lookup failed.`, error);
    return null;
  }
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const values = [lat1, lon1, lat2, lon2].map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    return Number.POSITIVE_INFINITY;
  }
  const [aLat, aLon, bLat, bLon] = values.map((value) => (value * Math.PI) / 180);
  const dLat = bLat - aLat;
  const dLon = bLon - aLon;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function writeAudit(action, session, targetId, before, after) {
  try {
    await db.collection("audit_logs").add({
      action,
      actor_user_id: session.userId,
      target_collection: "attendance_records",
      target_id: targetId,
      before,
      after,
      created_at: Date.now(),
    });
  } catch (error) {
    console.warn("[submit-attendance-checkin] audit write skipped.", error);
  }
}
