const { Enrollment, Student, Course } = require("../models");
const { Op } = require("sequelize");

// Helper for consistent error responses
const handleError = (res, err) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};

// Helper function to validate enrollment eligibility
const validateEnrollmentEligibility = async (studentId, courseId) => {
  const student = await Student.findByPk(studentId);
  if (!student) {
    throw { statusCode: 404, message: "Student not found" };
  }

  const course = await Course.findByPk(courseId);
  if (!course) {
    throw { statusCode: 404, message: "Course not found" };
  }

  // Check enrollment dates
  const now = new Date();
  const enrollStart = new Date(course.enrollment_start_date);
  const enrollDeadline = new Date(course.enrollment_deadline);

  if (now < enrollStart || now > enrollDeadline) {
    throw { 
      statusCode: 400, 
      message: "Enrollment is not open for this course",
      meta: {
        enrollment_start: course.enrollment_start_date,
        enrollment_deadline: course.enrollment_deadline,
        current_time: now
      }
    };
  }

  // Check eligibility based on course type
  if (course.course_type === 'regular') {
    if (student.year !== course.year_level) {
      throw { 
        statusCode: 403, 
        message: `This regular course is only for year ${course.year_level} students. Your year: ${student.year}`,
        meta: {
          required_year: course.year_level,
          student_year: student.year
        }
      };
    }
  }
  // For event courses, no year check needed - all students are eligible

  // Check if already enrolled
  const existingEnroll = await Enrollment.findOne({
    where: { studentId, courseId }
  });

  if (existingEnroll) {
    throw { 
      statusCode: 400, 
      message: "Already enrolled in this course",
      meta: {
        enrolled_at: existingEnroll.created_at
      }
    };
  }

  return { student, course };
};

// ------------------------------
// Admin / SuperAdmin enrollment
// ------------------------------
exports.enrollByAdmin = async (req, res) => {
  try {
    const user = req.user;

    // Only admins or superadmins can use this route
    if (user.role !== "admin" && user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only Admins can enroll students",
      });
    }

    const { studentId, courseId } = req.body;

    if (!studentId || !courseId) {
      return res.status(400).json({
        success: false,
        message: "studentId and courseId are required",
      });
    }

    // Use the validation helper (admins might want to bypass year checks? 
    // If so, we can add a flag. For now, we'll enforce rules for data integrity)
    try {
      await validateEnrollmentEligibility(studentId, courseId);
    } catch (validationErr) {
      // For admins, we might want to allow override in some cases
      // You can add a 'force' flag in the request body if needed
      const { force } = req.body;
      
      if (!force) {
        throw validationErr;
      }
      
      // If force is true, only check if course exists and not already enrolled
      const course = await Course.findByPk(courseId);
      const student = await Student.findByPk(studentId);
      
      if (!course || !student) {
        throw { statusCode: 404, message: "Student or Course not found" };
      }
      
      const existingEnroll = await Enrollment.findOne({
        where: { studentId, courseId }
      });
      
      if (existingEnroll) {
        throw { statusCode: 400, message: "Already enrolled" };
      }
    }

    const newEnroll = await Enrollment.create({ 
      studentId, 
      courseId,
      enrolled_by: 'admin',
      enrolled_by_admin_id: user.user_id
    });

    // Fetch the complete enrollment with relations
    const enrollment = await Enrollment.findByPk(newEnroll.id, {
      include: [
        { model: Student, as: "student", attributes: ["id", "first_name", "father_name", "email", "year"] },
        { model: Course, as: "course", attributes: ["id", "course_name", "course_type", "year_level"] }
      ]
    });

    res.status(201).json({ 
      success: true, 
      message: enrollment.course.course_type === 'regular' 
        ? "Student enrolled in regular course successfully" 
        : "Student enrolled in event successfully",
      data: enrollment 
    });
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------
// Remove enrollment
// ------------------------------
exports.removeEnrollment = async (req, res) => {
  try {
    const { id } = req.params;

    const enrollmentEntity = await Enrollment.findByPk(id, {
      include: [
        { model: Course, as: "course", attributes: ["course_name", "course_type"] }
      ]
    });
    
    if (!enrollmentEntity) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    await enrollmentEntity.destroy();
    
    res.json({ 
      success: true, 
      message: "Enrollment removed successfully",
      meta: {
        course_type: enrollmentEntity.course?.course_type,
        course_name: enrollmentEntity.course?.course_name
      }
    });
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------
// List all enrollments (with optional filters)
// ------------------------------
exports.getEnrollments = async (req, res) => {
  try {
    const { courseType, studentId, courseId, page = 1, limit = 50 } = req.query;
    
    const whereClause = {};
    if (studentId) whereClause.studentId = studentId;
    if (courseId) whereClause.courseId = courseId;

    const courseWhereClause = {};
    if (courseType && ['regular', 'event'].includes(courseType)) {
      courseWhereClause.course_type = courseType;
    }

    const offset = (page - 1) * limit;

    const { count, rows: enrollments } = await Enrollment.findAndCountAll({
      where: whereClause,
      include: [
        { 
          model: Student, 
          as: "student",
          attributes: ["id", "first_name", "father_name", "grand_father_name", "email", "year"]
        },
        { 
          model: Course, 
          as: "course",
          where: courseWhereClause,
          attributes: ["id", "course_name", "course_type", "year_level", "semester"]
        },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Group by course type for better overview
    const grouped = {
      regular: enrollments.filter(e => e.course.course_type === 'regular'),
      events: enrollments.filter(e => e.course.course_type === 'event')
    };

    res.json({ 
      success: true, 
      data: enrollments,
      grouped,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------
// Remove enrollment by studentId + courseId
// ------------------------------
exports.removeEnrollmentByAdmin = async (req, res) => {
  try {
    const { studentId, courseId } = req.body;

    if (!studentId || !courseId) {
      return res.status(400).json({
        success: false,
        message: "studentId and courseId are required",
      });
    }

    const enrollment = await Enrollment.findOne({
      where: { studentId, courseId },
      include: [
        { model: Course, as: "course", attributes: ["course_name", "course_type"] }
      ]
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    await enrollment.destroy();

    return res.json({
      success: true,
      message: "Enrollment removed successfully",
      meta: {
        course_type: enrollment.course?.course_type,
        course_name: enrollment.course?.course_name
      }
    });
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------
// Student self-enrollment
// ------------------------------
exports.enrollSelf = async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "courseId is required",
      });
    }

    // Validate eligibility
    const { student, course } = await validateEnrollmentEligibility(studentId, courseId);

    // Create enrollment
    const newEnroll = await Enrollment.create({ 
      studentId, 
      courseId,
      enrolled_by: 'self'
    });

    // Fetch complete enrollment with relations
    const enrollment = await Enrollment.findByPk(newEnroll.id, {
      include: [
        { 
          model: Student, 
          as: "student", 
          attributes: ["id", "first_name", "father_name", "email", "year"] 
        },
        { 
          model: Course, 
          as: "course", 
          attributes: ["id", "course_name", "course_type", "year_level", "semester", "start_date", "end_date"] 
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: course.course_type === 'regular' 
        ? "Successfully enrolled in regular course" 
        : "Successfully registered for event",
      data: enrollment,
      meta: {
        course_type: course.course_type,
        note: course.course_type === 'event' 
          ? "You can attend any session of this event regardless of your year level"
          : `This course is for year ${course.year_level} students only`,
        enrollment_status: "active",
        valid_until: course.end_date
      }
    });
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Enrollment failed",
      meta: err.meta || null
    });
  }
};

// ------------------------------
// Bulk enroll students (Admin only)
// ------------------------------
exports.bulkEnrollByAdmin = async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== "admin" && user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only Admins can perform bulk enrollment",
      });
    }

    const { studentIds, courseId } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0 || !courseId) {
      return res.status(400).json({
        success: false,
        message: "studentIds (array) and courseId are required",
      });
    }

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const results = {
      successful: [],
      failed: []
    };

    for (const studentId of studentIds) {
      try {
        // Check if already enrolled
        const existing = await Enrollment.findOne({
          where: { studentId, courseId }
        });

        if (existing) {
          results.failed.push({
            studentId,
            reason: "Already enrolled"
          });
          continue;
        }

        // Validate eligibility (but don't fail the whole batch)
        const student = await Student.findByPk(studentId);
        if (!student) {
          results.failed.push({
            studentId,
            reason: "Student not found"
          });
          continue;
        }

        if (course.course_type === 'regular' && student.year !== course.year_level) {
          results.failed.push({
            studentId,
            reason: `Year mismatch. Student year: ${student.year}, Required: ${course.year_level}`
          });
          continue;
        }

        const enrollment = await Enrollment.create({
          studentId,
          courseId,
          enrolled_by: 'admin_bulk',
          enrolled_by_admin_id: user.user_id
        });

        results.successful.push({
          studentId,
          enrollmentId: enrollment.id
        });
      } catch (err) {
        results.failed.push({
          studentId,
          reason: err.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Bulk enrollment completed. ${results.successful.length} succeeded, ${results.failed.length} failed.`,
      data: results,
      meta: {
        course_type: course.course_type,
        course_name: course.course_name,
        total_requested: studentIds.length
      }
    });
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------
// Get enrollment statistics
// ------------------------------
exports.getEnrollmentStats = async (req, res) => {
  try {
    const { courseId } = req.params;

    const whereClause = {};
    if (courseId) whereClause.courseId = courseId;

    const enrollments = await Enrollment.findAll({
      where: whereClause,
      include: [
        { model: Course, as: "course", attributes: ["id", "course_name", "course_type", "year_level"] }
      ]
    });

    // Calculate statistics
    const stats = {
      total: enrollments.length,
      byCourseType: {
        regular: enrollments.filter(e => e.course?.course_type === 'regular').length,
        events: enrollments.filter(e => e.course?.course_type === 'event').length
      },
      byYear: {},
      courses: {}
    };

    enrollments.forEach(enrollment => {
      // Group by year
      const year = enrollment.student?.year;
      if (year) {
        stats.byYear[year] = (stats.byYear[year] || 0) + 1;
      }

      // Group by course
      const courseId = enrollment.courseId;
      if (!stats.courses[courseId]) {
        stats.courses[courseId] = {
          course_name: enrollment.course?.course_name,
          course_type: enrollment.course?.course_type,
          count: 0
        };
      }
      stats.courses[courseId].count++;
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    handleError(res, err);
  }
};

// const { Enrollment, Student, Course } = require("../models");
// const { enrollStudentSelf } = require("../services/enrollment.service");


// // Helper for consistent error responses
// const handleError = (res, err) => {
//   console.error(err);
//   res.status(err.statusCode || 500).json({
//     success: false,
//     message: err.message || "Internal Server Error",
//   });
// };

// // ------------------------------
// // Admin / SuperAdmin enrollment
// // ------------------------------
// exports.enrollByAdmin = async (req, res) => {
//   try {
//     const user = req.user; // injected by authentication middleware

//     // Only admins or superadmins can use this route
//     if (user.role !== "admin" && user.role !== "super_admin") {
//       return res.status(403).json({
//         success: false,
//         message: "Forbidden: Only Admins can enroll students",
//       });
//     }

//     const { studentId, courseId } = req.body;

//     if (!studentId || !courseId) {
//       return res.status(400).json({
//         success: false,
//         message: "studentId and courseId are required",
//       });
//     }

//     const studentEntity = await Student.findByPk(studentId);
//     const courseEntity = await Course.findByPk(courseId);

//     if (!studentEntity || !courseEntity) {
//       return res.status(404).json({
//         success: false,
//         message: "Student or Course not found",
//       });
//     }

//     // Prevent duplicate enrollment
//     const existingEnroll = await Enrollment.findOne({
//       where: { studentId, courseId },
//     });
//     if (existingEnroll) {
//       return res.status(400).json({
//         success: false,
//         message: "Student is already enrolled in this course",
//       });
//     }

//     const newEnroll = await Enrollment.create({ studentId, courseId });
//     res.status(201).json({ success: true, data: newEnroll });
//   } catch (err) {
//     handleError(res, err);
//   }
// };

// // ------------------------------
// // Remove enrollment
// // ------------------------------
// exports.removeEnrollment = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const enrollmentEntity = await Enrollment.findByPk(id);
//     if (!enrollmentEntity) {
//       return res.status(404).json({
//         success: false,
//         message: "Enrollment not found",
//       });
//     }

//     await enrollmentEntity.destroy();
//     res.json({ success: true, message: "Enrollment removed" });
//   } catch (err) {
//     handleError(res, err);
//   }
// };

// // ------------------------------
// // List all enrollments
// // ------------------------------
// exports.getEnrollments = async (_req, res) => {
//   try {
//     const enrollments = await Enrollment.findAll({
//       include: [
//         { model: Student, as: "student" },
//         { model: Course, as: "course" },
//       ],
//     });
//     res.json({ success: true, data: enrollments });
//   } catch (err) {
//     handleError(res, err);
//   }
// };
// // ------------------------------
// // Remove enrollment by studentId + courseId
// // ------------------------------
// exports.removeEnrollmentByAdmin = async (req, res) => {
//   try {
//     const { studentId, courseId } = req.body;

//     if (!studentId || !courseId) {
//       return res.status(400).json({
//         success: false,
//         message: "studentId and courseId are required",
//       });
//     }

//     const enrollment = await Enrollment.findOne({
//       where: { studentId, courseId },
//     });

//     if (!enrollment) {
//       return res.status(404).json({
//         success: false,
//         message: "Enrollment not found",
//       });
//     }

//     await enrollment.destroy();

//     return res.json({
//       success: true,
//       message: "Enrollment removed successfully",
//     });
//   } catch (err) {
//     handleError(res, err);
//   }
// };

// // ------------------------------
// // Student self-enrollment
// // ------------------------------
// exports.enrollSelf = async (req, res) => {
//   try {
//     const studentId = req.user.user_id; // from JWT middleware
//     const { courseId } = req.body;

//     if (!courseId) {
//       return res.status(400).json({
//         success: false,
//         message: "courseId is required",
//       });
//     }

//     const enrollment = await enrollStudentSelf({
//       studentId,
//       courseId,
//     });

//     res.status(201).json({
//       success: true,
//       message: "Enrolled successfully",
//       data: enrollment,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(err.statusCode || 500).json({
//       success: false,
//       message: err.message || "Enrollment failed",
//     });
//   }
// };
