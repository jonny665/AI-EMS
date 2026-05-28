'use strict';
const db = uniCloud.database();
const $ = db.command.aggregate;

exports.main = async (event, context) => {
  // Permission check: only teachers/admins can view evaluations
  const { role } = context.auth;
  if (!['teacher', 'admin'].includes(role)) {
    return { code: 403, message: 'No permission to view course evaluations', data: null };
  }

  const { course_id } = event;
  const whereCondition = course_id ? { course_id } : {};

  try {
    // Aggregate calculation: average score, total count, rating distribution
    const aggregateRes = await db.collection('course_evaluations')
      .aggregate()
      .match(whereCondition)
      .group({
        _id: '$course_id',
        course_name: $.first('$course_name'),
        total_evaluations: $.sum(1),
        average_rating: $.avg('$rating'),
        rating_5: $.sum($.cond([$.eq(['$rating', 5]), 1, 0])),
        rating_4: $.sum($.cond([$.eq(['$rating', 4]), 1, 0])),
        rating_3: $.sum($.cond([$.eq(['$rating', 3]), 1, 0])),
        rating_2: $.sum($.cond([$.eq(['$rating', 2]), 1, 0])),
        rating_1: $.sum($.cond([$.eq(['$rating', 1]), 1, 0]))
      })
      .end();

    // Query anonymous evaluation list (NO student identity information returned)
    const listRes = await db.collection('course_evaluations')
      .where(whereCondition)
      .field({
        rating: true,
        content: true,
        create_time: true,
        course_id: true,
        course_name: true,
        _id: false,
        anonymous_token: false
      })
      .orderBy('create_time', 'desc')
      .get();

    // Format response data
    const summaryList = aggregateRes.data.map(item => ({
      course_id: item._id,
      course_name: item.course_name,
      total_evaluations: item.total_evaluations,
      average_rating: item.average_rating.toFixed(1),
      rating_distribution: {
        5: item.rating_5,
        4: item.rating_4,
        3: item.rating_3,
        2: item.rating_2,
        1: item.rating_1
      }
    }));

    return {
      code: 200,
      message: 'Query successful',
      data: {
        summary: summaryList,
        anonymous_evaluations: listRes.data
      }
    };

  } catch (error) {
    console.error('Failed to query evaluations:', error);
    return { code: 500, message: 'Server error, please try again later', data: null };
  }
};