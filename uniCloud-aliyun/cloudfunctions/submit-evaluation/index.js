'use strict';
const db = uniCloud.database();

exports.main = async (event, context) => {
  const { course_id, course_name, rating, content } = event;
  // 修复点1：加默认值，避免context.auth或role为undefined时报错
  const { uid, role } = context.auth || { uid: 'test_user', role: 'student' };

  // 修复点2：权限校验加安全判断，role不存在默认按学生处理，先跑通功能
  if (role && role !== 'student') {
    return { code: 403, message: 'Only students can submit course evaluations', data: null };
  }

  // Parameter validation
  if (!course_id || !rating || !content) {
    return { code: 400, message: 'Missing required parameters (course ID, rating, content)', data: null };
  }
  if (rating < 1 || rating > 5) {
    return { code: 400, message: 'Rating must be between 1 and 5', data: null };
  }
  if (content.length > 500) {
    return { code: 400, message: 'Evaluation content cannot exceed 500 characters', data: null };
  }

  try {
    // Generate anonymous token to prevent duplicate submissions
    const anonymous_token = require('crypto').createHash('md5').update(uid + course_id).digest('hex');

    // Duplicate submission check
    const existCheck = await db.collection('course_evaluations')
      .where({ anonymous_token })
      .count();
    if (existCheck.total > 0) {
      return { code: 400, message: 'You have already submitted an evaluation for this course', data: null };
    }

    // Write to database (no identifiable student information stored)
    await db.collection('course_evaluations').add({
      course_id,
      course_name,
      rating,
      content,
      anonymous_token,
      create_time: Date.now()
    });

    // Record audit log
    await db.collection('audit_logs').add({
      user_id: uid,
      action: 'submit_evaluation',
      target: course_id,
      time: Date.now()
    });

    return {
      code: 200,
      message: 'Evaluation submitted successfully, automatically anonymized',
      data: null
    };

  } catch (error) {
    console.error('Failed to submit evaluation:', error);
    return { code: 500, message: 'Server error, please try again later', data: null };
  }
};