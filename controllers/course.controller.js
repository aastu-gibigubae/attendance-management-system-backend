const { Course, Enrollment, Student } = require("../models");
const { Op } = require("sequelize");

const handleError = (res, err) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};

// -------------------
// Create Course (Admin) - Supports both regular and event courses
// -------------------
exports.createCourse = async (req, res) => {
  try {
    const {
      course_name,
      description,
      course_type = 'regular', // Default to regular if not specified
      start_date,
      end_date,
      enrollment_start_date,
      enrollment_deadline,
      year_level,
      semester
    } = req.body;

    // Validate required fields for all course types
    if (!course_name || !description || !start_date || !end_date || 
        !enrollment_start_date || !enrollment_deadline) {
      throw { statusCode: 400, message: "Basic course fields are required" };
    }

    // Type-specific validation
    if (course_type === 'regular') {
      if (!year_level || !semester) {
        throw { 
          statusCode: 400, 
          message: "Year level and semester are required for regular courses" 
        };
      }

      // Validate year_level and semester ranges
      if (year_level < 1 || year_level > 5) {
        throw { statusCode: 400, message: "year_level must be between 1 and 5" };
      }
      if (![1, 2].includes(semester)) {
        throw { statusCode: 400, message: "semester must be 1 or 2" };
      }
    }

    const courseData = {
      course_name,
      description,
      course_type,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      enrollment_start_date: new Date(enrollment_start_date),
      enrollment_deadline: new Date(enrollment_deadline),
    };

    // Only add year_level and semester for regular courses
    if (course_type === 'regular') {
      courseData.year_level = year_level;
      courseData.semester = semester;
    }

    const course = await Course.create(courseData);

    res.status(201).json({ 
      success: true, 
      data: course,
      message: course_type === 'regular' 
        ? "Regular course created successfully" 
        : "Event course created successfully"
    });
  } catch (err) {
    handleError(res, err);
  }
};

// -------------------
// Get All Courses (with optional type filter)
// -------------------
// exports.getCourses = async (req, res) => {
//   try {
//     const { type } = req.query; // Optional filter by course_type
    
//     const whereClause = {};
//     if (type && ['regular', 'event'].includes(type)) {
//       whereClause.course_type = type;
//     }

//     const courses = await Course.findAll({
//       where: whereClause,
//       order: [
//         ['course_type', 'ASC'],
//         ['semester', 'ASC'],
//         ['course_name', 'ASC']
//       ]
//     });
    
//     res.json({ success: true, data: courses });
//   } catch (err) {
//     handleError(res, err);
//   }
// };
// -------------------
// Get All Courses (with optional type filter and enrollment status for student)
// -------------------
// -------------------
// Get All Courses (with optional type filter and enrollment status for student)
// -------------------
exports.getCourses = async (req, res) => {
  try {
    const { type } = req.query; // Optional filter by course_type
    
    // Check if user exists in request
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in."
      });
    }

    const studentId = Number(req.user.user_id);
    
    // Validate studentId is a valid number
    if (isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    const whereClause = {};
    if (type && ['regular', 'event'].includes(type)) {
      whereClause.course_type = type;
    }

    // Get courses with enrollment information
    const courses = await Course.findAll({
      where: whereClause,
      include: [
        {
          model: Enrollment,
          as: "enrollments",
          where: { studentId },
          required: false,
        },
      ],
      order: [
        ['course_type', 'ASC'],
        ['semester', 'ASC'],
        ['course_name', 'ASC']
      ],
    });

    // Format the response
    const formattedCourses = courses.map(course => ({
      id: course.id,
      course_name: course.course_name,
      description: course.description,
      course_type: course.course_type,
      semester: course.semester,
      year_level: course.year_level,
      start_date: course.start_date,
      end_date: course.end_date,
      enrollment_start_date: course.enrollment_start_date,
      enrollment_deadline: course.enrollment_deadline,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      alreadyEnrolled: course.enrollments.length > 0,
    }));

    res.json({
      success: true,
      totalCourses: formattedCourses.length,
      data: formattedCourses,
    });

  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};
// -------------------
// Get Course by ID
// -------------------
exports.getCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findByPk(id);
    if (!course) throw { statusCode: 404, message: "Course not found" };
    res.json({ success: true, data: course });
  } catch (err) {
    handleError(res, err);
  }
};

// -------------------
// Update Course
// -------------------
exports.updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findByPk(id);
    if (!course) throw { statusCode: 404, message: "Course not found" };

    const {
      course_name,
      description,
      course_type,
      start_date,
      end_date,
      enrollment_start_date,
      enrollment_deadline,
      year_level,
      semester
    } = req.body;

    // Prevent changing course type if there are enrollments or attendance
    if (course_type && course_type !== course.course_type) {
      const enrollments = await Enrollment.count({ where: { courseId: id } });
      if (enrollments > 0) {
        throw { 
          statusCode: 400, 
          message: "Cannot change course type because there are existing enrollments" 
        };
      }
    }

    // Validate based on course type
    const targetType = course_type || course.course_type;
    
    if (targetType === 'regular') {
      if (year_level && (year_level < 1 || year_level > 5)) {
        throw { statusCode: 400, message: "year_level must be between 1 and 5" };
      }
      if (semester && ![1, 2].includes(semester)) {
        throw { statusCode: 400, message: "semester must be 1 or 2" };
      }
    }

    const updateData = {
      course_name: course_name || course.course_name,
      description: description || course.description,
      course_type: course_type || course.course_type,
      start_date: start_date ? new Date(start_date) : course.start_date,
      end_date: end_date ? new Date(end_date) : course.end_date,
      enrollment_start_date: enrollment_start_date
        ? new Date(enrollment_start_date)
        : course.enrollment_start_date,
      enrollment_deadline: enrollment_deadline
        ? new Date(enrollment_deadline)
        : course.enrollment_deadline,
    };

    // Handle year_level and semester based on course type
    if (targetType === 'regular') {
      updateData.year_level = year_level || course.year_level;
      updateData.semester = semester || course.semester;
    } else {
      // For event courses, ensure year_level and semester are null
      updateData.year_level = null;
      updateData.semester = null;
    }

    await course.update(updateData);

    res.json({ 
      success: true, 
      data: course,
      message: "Course updated successfully"
    });
  } catch (err) {
    handleError(res, err);
  }
};

// -------------------
// Delete Course
// -------------------
exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findByPk(id);
    if (!course) throw { statusCode: 404, message: "Course not found" };

    await course.destroy();
    res.json({ success: true, message: "Course deleted successfully" });
  } catch (err) {
    handleError(res, err);
  }
};

// -------------------
// Get Courses Enrolled by a Student
// -------------------
exports.getStudentCourses = async (req, res) => {
  try {
    const userId = Number(req.user.user_id);
    const { type } = req.query; // Optional filter by course type

    const includeWhere = { studentId: userId };
    
    const courseWhere = {};
    if (type && ['regular', 'event'].includes(type)) {
      courseWhere.course_type = type;
    }

    const courses = await Course.findAll({
      where: courseWhere,
      include: [
        {
          model: Enrollment,
          as: "enrollments",
          where: includeWhere,
          required: true,
        },
      ],
      order: [
        ['course_type', 'ASC'],
        ['semester', 'ASC'],
        ['course_name', 'ASC']
      ],
    });

    // Group by course type for better response structure
    // const grouped = {
    //   regular: courses.filter(c => c.course_type === 'regular'),
    //   events: courses.filter(c => c.course_type === 'event')
    // };

    res.json({ success: true, data: courses });
  } catch (err) {
    handleError(res, err);
  }
};

// -------------------
// Get Students in a Course
// -------------------
exports.getStudentsInCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!courseId) {
      throw { statusCode: 400, message: "courseId is required" };
    }

    const course = await Course.findByPk(courseId);
    if (!course) throw { statusCode: 404, message: "Course not found" };

    const enrollments = await Enrollment.findAll({
      where: { courseId },
      include: [
        {
          model: Student,
          as: "student",
        },
      ],
    });

    const students = enrollments.map((enr) => enr.student);

    res.json({
      success: true,
      courseId,
      course_type: course.course_type,
      totalStudents: students.length,
      students,
    });
  } catch (err) {
    handleError(res, err);
  }
};

// -------------------
// Search Students for Course
// -------------------
exports.searchStudentsForCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const query = req.query.query || "";

    if (!courseId) {
      return res.status(400).json({ success: false, message: "courseId is required" });
    }

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    const students = await Student.findAll({
      where: {
        [Op.or]: [
          { first_name: { [Op.like]: `%${query}%` } },
          { father_name: { [Op.like]: `%${query}%` } },
          { grand_father_name: { [Op.like]: `%${query}%` } },
          { christian_name: { [Op.like]: `%${query}%` } },
          { email: { [Op.like]: `%${query}%` } },
          { id_number: { [Op.like]: `%${query}%` } },
        ]
      },
      attributes: [
        "id",
        "first_name",
        "father_name",
        "grand_father_name",
        "christian_name",
        "email",
        "id_number",
        "department",
        "year"
      ],
      include: [
        {
          model: Enrollment,
          as: "enrollments",
          where: { courseId },
          required: false
        }
      ]
    });

    const formatted = students.map(s => ({
      id: s.id,
      fullName: `${s.first_name} ${s.father_name} ${s.grand_father_name}`,
      email: s.email,
      idNumber: s.id_number,
      department: s.department,
      year: s.year,
      alreadyEnrolled: s.enrollments.length > 0,
      // Add eligibility info based on course type
      eligible: course.course_type === 'event' ? true : s.year === course.year_level
    }));

    res.json({
      success: true,
      course_type: course.course_type,
      total: formatted.length,
      students: formatted
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// -------------------
// Get Available Courses for Student (with events support)
// -------------------
exports.getAvailableCoursesForStudent = async (req, res) => {
  try {
    const studentId = Number(req.user.user_id);

    // Fetch the student to get their year
    const student = await Student.findByPk(studentId);
    if (!student) throw { statusCode: 404, message: "Student not found" };

    // Build where clause to include:
    // 1. Regular courses matching student's year
    // 2. All event courses (available to any student)
    const whereClause = {
      [Op.or]: [
        {
          course_type: 'regular',
          year_level: student.year
        },
        {
          course_type: 'event'
        }
      ]
    };

    const courses = await Course.findAll({
      where: whereClause,
      include: [
        {
          model: Enrollment,
          as: "enrollments",
          where: { studentId },
          required: false,
        },
      ],
      order: [
        ['course_type', 'ASC'], // Events first, then regular courses
        ['semester', 'ASC'],
        ['course_name', 'ASC']
      ],
    });

 const groupedCourses = {
      semester_1: [],
      semester_2: [],
    };

    courses.forEach((course) => {
      const formattedCourse = {
        id: course.id,
        course_name: course.course_name,
        description: course.description,
        semester: course.semester,
        start_date: course.start_date,
        end_date: course.end_date,
        enrollment_start_date: course.enrollment_start_date,
        enrollment_deadline: course.enrollment_deadline,
        alreadyEnrolled: course.enrollments.length > 0,
      };

      if (course.semester === 1) {
        groupedCourses.semester_1.push(formattedCourse);
      } else if (course.semester === 2) {
        groupedCourses.semester_2.push(formattedCourse);
      }
    });

    res.json({
      success: true,
      student: {
        id: student.id,
        name: `${student.first_name} ${student.father_name} ${student.grand_father_name}`,
        year: student.year,
      },
      totalCourses: courses.length,
      courses: groupedCourses,
    });

  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};
// -------------------
// Get All Events (helper endpoint)
// -------------------
exports.getAllEvents = async (req, res) => {
  try {
    const events = await Course.findAll({
      where: { course_type: 'event' },
      order: [['start_date', 'DESC']]
    });

    res.json({
      success: true,
      total: events.length,
      data: events
    });
  } catch (err) {
    handleError(res, err);
  }
};

// -------------------
// Get Courses by Year Level (regular courses only)
// -------------------
exports.getCoursesByYear = async (req, res) => {
  try {
    const { year } = req.params;

    if (!year || year < 1 || year > 5) {
      throw { statusCode: 400, message: "Valid year (1-5) is required" };
    }

    const courses = await Course.findAll({
      where: {
        course_type: 'regular',
        year_level: year
      },
      order: [['semester', 'ASC'], ['course_name', 'ASC']]
    });

    res.json({
      success: true,
      year: parseInt(year),
      total: courses.length,
      data: courses
    });
  } catch (err) {
    handleError(res, err);
  }
};


// const { Course, Enrollment, Student } = require("../models");
// const { Op } = require("sequelize");

// const handleError = (res, err) => {
//   console.error(err);
//   res.status(err.statusCode || 500).json({
//     success: false,
//     message: err.message || "Internal Server Error",
//   });
// };

// // -------------------
// // Create Course (Admin) - Supports both regular and event courses
// // -------------------
// exports.createCourse = async (req, res) => {
//   try {
//     const {
//       course_name,
//       description,
//       course_type = 'regular',
//       start_date,
//       end_date,
//       enrollment_start_date,
//       enrollment_deadline,
//       year_level,
//       semester
//     } = req.body;

//     // Validate required fields
//     if (!course_name || !description || !start_date || !end_date || 
//         !enrollment_start_date || !enrollment_deadline) {
//       throw { statusCode: 400, message: "Basic course fields are required" };
//     }

//     // Validate year_level and semester
//     if (year_level < 1 || year_level > 5) {
//       throw { statusCode: 400, message: "year_level must be between 1 and 5" };
//     }
//     if (![1, 2].includes(semester)) {
//       throw { statusCode: 400, message: "semester must be 1 or 2" };
//     }

//     const course = await Course.create({
//       course_name,
//       description,
//       start_date: new Date(start_date),
//       end_date: new Date(end_date),
//       enrollment_start_date: new Date(enrollment_start_date),
//       enrollment_deadline: new Date(enrollment_deadline),
//       year_level,
//       semester
//     });

//     res.status(201).json({ success: true, data: course });
//   } catch (err) {
//     handleError(res, err);
//   }
// };

// // -------------------
// // Get All Courses
// // -------------------
// exports.getCourses = async (req, res) => {
//   try {
//     const courses = await Course.findAll();
//     res.json({ success: true, data: courses });
//   } catch (err) {
//     handleError(res, err);
//   }
// };

// // -------------------
// // Get Course by ID
// // -------------------
// exports.getCourseById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const course = await Course.findByPk(id);
//     if (!course) throw { statusCode: 404, message: "Course not found" };
//     res.json({ success: true, data: course });
//   } catch (err) {
//     handleError(res, err);
//   }
// };

// // -------------------
// // Update Course
// // -------------------
// exports.updateCourse = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const course = await Course.findByPk(id);
//     if (!course) throw { statusCode: 404, message: "Course not found" };

//     const {
//       course_name,
//       description,
//       start_date,
//       end_date,
//       enrollment_start_date,
//       enrollment_deadline,
//       year_level,
//       semester
//     } = req.body;

//     // Validate year_level and semester if provided
//     if (year_level && (year_level < 1 || year_level > 5)) {
//       throw { statusCode: 400, message: "year_level must be between 1 and 5" };
//     }
//     if (semester && ![1, 2].includes(semester)) {
//       throw { statusCode: 400, message: "semester must be 1 or 2" };
//     }

//     await course.update({
//       course_name: course_name || course.course_name,
//       description: description || course.description,
//       start_date: start_date ? new Date(start_date) : course.start_date,
//       end_date: end_date ? new Date(end_date) : course.end_date,
//       enrollment_start_date: enrollment_start_date
//         ? new Date(enrollment_start_date)
//         : course.enrollment_start_date,
//       enrollment_deadline: enrollment_deadline
//         ? new Date(enrollment_deadline)
//         : course.enrollment_deadline,
//       year_level: year_level || course.year_level,
//       semester: semester || course.semester
//     });

//     res.json({ success: true, data: course });
//   } catch (err) {
//     handleError(res, err);
//   }
// };

// // -------------------
// // Delete Course
// // -------------------
// exports.deleteCourse = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const course = await Course.findByPk(id);
//     if (!course) throw { statusCode: 404, message: "Course not found" };

//     await course.destroy();
//     res.json({ success: true, message: "Course deleted successfully" });
//   } catch (err) {
//     handleError(res, err);
//   }
// };

// // -------------------
// // Get Courses Enrolled by a Student
// // -------------------
// exports.getStudentCourses = async (req, res) => {
//   try {
//     const userId = Number(req.user.user_id);

//     const courses = await Course.findAll({
//       include: [
//         {
//           model: Enrollment,
//           as: "enrollments",
//           where: { studentId: userId },
//           required: true,
//         },
//       ],
//     });

//     res.json({ success: true, data: courses });
//   } catch (err) {
//     handleError(res, err);
//   }
// };

// // -------------------
// // Get Students in a Course
// // -------------------
// exports.getStudentsInCourse = async (req, res) => {
//   try {
//     const { courseId } = req.params;

//     if (!courseId) {
//       throw { statusCode: 400, message: "courseId is required" };
//     }

//     const course = await Course.findByPk(courseId);
//     if (!course) throw { statusCode: 404, message: "Course not found" };

//     const enrollments = await Enrollment.findAll({
//       where: { courseId },
//       include: [
//         {
//           model: Student,
//           as: "student",
//         },
//       ],
//     });

//     const students = enrollments.map((enr) => enr.student);

//     res.json({
//       success: true,
//       courseId,
//       totalStudents: students.length,
//       students,
//     });
//   } catch (err) {
//     handleError(res, err);
//   }
// };

// // -------------------
// // Search Students for Course
// // -------------------
// exports.searchStudentsForCourse = async (req, res) => {
//   try {
//     const { courseId } = req.params;
//     const query = req.query.query || "";

//     if (!courseId) {
//       return res.status(400).json({ success: false, message: "courseId is required" });
//     }

//     const students = await Student.findAll({
//       where: {
//         [Op.or]: [
//           { first_name: { [Op.like]: `%${query}%` } },
//           { father_name: { [Op.like]: `%${query}%` } },
//           { grand_father_name: { [Op.like]: `%${query}%` } },
//           { christian_name: { [Op.like]: `%${query}%` } },
//           { email: { [Op.like]: `%${query}%` } },
//           { id_number: { [Op.like]: `%${query}%` } },
//         ]
//       },
//       attributes: [
//         "id",
//         "first_name",
//         "father_name",
//         "grand_father_name",
//         "christian_name",
//         "email",
//         "id_number",
//         "department",
//         "year"
//       ],
//       include: [
//         {
//           model: Enrollment,
//           as: "enrollments",
//           where: { courseId },
//           required: false
//         }
//       ]
//     });

//     const formatted = students.map(s => ({
//       id: s.id,
//       fullName: `${s.first_name} ${s.father_name} ${s.grand_father_name}`,
//       email: s.email,
//       idNumber: s.id_number,
//       department: s.department,
//       year: s.year,
//       alreadyEnrolled: s.enrollments.length > 0
//     }));

//     res.json({
//       success: true,
//       total: formatted.length,
//       students: formatted
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };


// exports.getAvailableCoursesForStudent = async (req, res) => {
//   try {
//     const studentId = Number(req.user.user_id);

//     // Fetch the student to get their year
//     const student = await Student.findByPk(studentId);
//     if (!student) throw { statusCode: 404, message: "Student not found" };

//     // Fetch courses for the student's year
//     const courses = await Course.findAll({
//       where: {
//         year_level: student.year,
//       },
//       include: [
//         {
//           model: Enrollment,
//           as: "enrollments",
//           where: { studentId },
//           required: false,
//         },
//       ],
//       order: [["semester", "ASC"], ["course_name", "ASC"]],
//     });

//     // Prepare semester-based grouping
//     const groupedCourses = {
//       semester_1: [],
//       semester_2: [],
//     };

//     courses.forEach((course) => {
//       const formattedCourse = {
//         id: course.id,
//         course_name: course.course_name,
//         description: course.description,
//         semester: course.semester,
//         start_date: course.start_date,
//         end_date: course.end_date,
//         enrollment_start_date: course.enrollment_start_date,
//         enrollment_deadline: course.enrollment_deadline,
//         alreadyEnrolled: course.enrollments.length > 0,
//       };

//       if (course.semester === 1) {
//         groupedCourses.semester_1.push(formattedCourse);
//       } else if (course.semester === 2) {
//         groupedCourses.semester_2.push(formattedCourse);
//       }
//     });

//     res.json({
//       success: true,
//       student: {
//         id: student.id,
//         name: `${student.first_name} ${student.father_name} ${student.grand_father_name}`,
//         year: student.year,
//       },
//       totalCourses: courses.length,
//       courses: groupedCourses,
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(err.statusCode || 500).json({
//       success: false,
//       message: err.message || "Internal server error",
//     });
//   }
// };
