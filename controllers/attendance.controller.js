const {
  Attendance,
  Student,
  Enrollment,
  StudentAttendance,
  Course,
} = require("../models");

// Helper for errors
const handleError = (res, err) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};

// ------------------------------
// Generate random attendance code
// ------------------------------
const generateCode = (length = 4) => {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
};


const TWO_HOURS = 2 * 60 * 60 * 1000;

const calculateExpiry = (attendanceDate) => {
  const attendanceTime = new Date(attendanceDate);
  const expiresAt = new Date(attendanceTime.getTime() + TWO_HOURS);
  const now = new Date();

  return {
    attendanceTime,
    expiresAt,
    isExpired: now > expiresAt,
  };
};
// ------------------------------
// Create Attendance (Admin)
// ------------------------------
exports.createAttendance = async (req, res) => {
  try {
    const { courseId, minutes } = req.body;

    if (!courseId || typeof minutes !== "number") {
      throw { statusCode: 400, message: "courseId and minutes are required" };
    }

    const course = await Course.findByPk(courseId);
    if (!course) throw { statusCode: 404, message: "Course not found" };

    // ---- Time calculation ----
    const startTime = new Date();
    const expiresAt = new Date(startTime.getTime() + minutes * 60000);

    const code = generateCode();

    // ---- Create Attendance ----
    const attendance = await Attendance.create({
      courseId,
      date: startTime,
      minutes,
      code,
    });

    // ---- Get all enrolled students ----
    const enrollments = await Enrollment.findAll({
      where: { courseId },
      attributes: ["studentId"],
    });

    // No enrolled students? Still create attendance.
    if (enrollments.length > 0) {
      const attendanceRows = enrollments.map((enr) => ({
        attendanceId: attendance.id,
        studentId: enr.studentId,
        present: false, // default
      }));

      await StudentAttendance.bulkCreate(attendanceRows);
    }

    // const expiryData = calculateExpiry(attendance.date);

    res.status(201).json({
      success: true,
      message: "Attendance created and students initialized",
      data: {
        attendance,
        expiresAt,
        isExpired: false,
        totalStudents: enrollments.length,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------
// Mark attendance (Student)
// ------------------------------
// ------------------------------
// Mark attendance (Student) with 2-hour lock
// ------------------------------
exports.markAttendanceStudent = async (req, res) => {
  try {
    const user = req.user; // from authenticate middleware
    const { attendanceId, code } = req.body;

    if (!attendanceId || !code)
      throw { statusCode: 400, message: "attendanceId and code are required" };

    const attendance = await Attendance.findByPk(attendanceId);
    if (!attendance) throw { statusCode: 404, message: "Attendance not found" };
    
    const isEnrolled = await Enrollment.findOne({
      where: { studentId: user.user_id, courseId: attendance.courseId },
    });
    if (!isEnrolled)
      throw {
        statusCode: 403,
        message: "You are not enrolled in this course",
      };
    
    // ---- Check Code ----
    if (attendance.code !== code)
      throw { statusCode: 400, message: "Invalid attendance code" };

    // ---- Check hour lock ----
    const startTime = new Date(attendance.date);
    const expiresAt = new Date(startTime.getTime() + attendance.minutes * 60000);
    const now = new Date();

    const status =
      now < startTime
        ? "UPCOMING"
        : now > expiresAt
        ? "CLOSED"
        : "OPEN";

    if (status === "UPCOMING" || status === "CLOSED") {
      return res.status(400).json({
        success: false,
        message:
          status === "UPCOMING"
            ? "Attendance has not started yet."
            : "Attendance window has closed.",
        meta: { startTime, expiresAt, isExpired: status === "CLOSED", status },
      });
    }

    // ---- Find student attendance row ----
    let record = await StudentAttendance.findOne({
      where: { attendanceId, studentId: user.user_id },
    });

    // ---- Update if exists ----
    if (record) {
      record.present = true;
      await record.save();
    } else {
      record = await StudentAttendance.create({
        attendanceId,
        studentId: user.user_id,
        present: true,
      });
    }

    res.json({
      success: true,
      message: "Attendance marked successfully",
      data: record,
      meta: {
          startTime: attendance.startTime,
          expiresAt: attendance.expiresAt,
          isExpired: false,
          status: "OPEN",
        },
    });
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------
// Mark or Update attendance (Admin)
// ------------------------------
exports.markAttendanceAdmin = async (req, res) => {
  try {
    const { attendanceId, studentId, present } = req.body;
    if (!attendanceId || !studentId || typeof present !== "boolean") {
      throw {
        statusCode: 400,
        message: "attendanceId, studentId, and present(boolean) are required",
      };
    }

    const attendance = await Attendance.findByPk(attendanceId);
    if (!attendance) throw { statusCode: 404, message: "Attendance not found" };

    const student = await Student.findByPk(studentId);
    if (!student) throw { statusCode: 404, message: "Student not found" };
    
    const isEnrolled = await Enrollment.findOne({
      where: { studentId, courseId: attendance.courseId },
    });

    if (!isEnrolled)
      throw {
        statusCode: 400,
        message: "Student is not enrolled in this course",
      };

    const startTime = new Date(attendance.date);
    const expiresAt = new Date(startTime.getTime() + attendance.minutes * 60000);
    const now = new Date();
    const isExpired = now > expiresAt;

    let record = await StudentAttendance.findOne({
      where: { attendanceId, studentId },
    });

    if (record) {
      // Update existing record
      record.present = present;
      await record.save();
      return res.json({
        success: true,
        message: "Attendance updated",
        data: record,
        meta: { startTime, expiresAt, isExpired },
      });
    } else {
      // Create new record
      record = await StudentAttendance.create({
        attendanceId,
        studentId,
        present,
      });
      return res.status(201).json({
        success: true,
        message: "Attendance marked",
        data: record,
        meta: { startTime, expiresAt, isExpired },
      });
    }
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------
// Get attendance by student
// ------------------------------
exports.getStudentAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;

    const records = await StudentAttendance.findAll({
      where: { studentId },
      include: [
        { model: Attendance, as: "attendance" },
        { model: Student, as: "student" },
      ],
    });

    const now = new Date();

    const enhanced = records.map((record) => {
      const attendance = record.attendance;
      const startTime = new Date(attendance.date);
      const expiresAt = new Date(startTime.getTime() + attendance.minutes * 60000);

      const status =
        now < startTime
          ? "UPCOMING"
          : now > expiresAt
          ? "CLOSED"
          : "OPEN";

      return {
        ...record.toJSON(),
        meta: { startTime, expiresAt, isExpired: now > expiresAt, status,course_type: attendance.course?.course_type },
      };
    });

    res.json({ success: true, data: enhanced });
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------
// Get attendance by course
// ------------------------------
exports.getCourseAttendance = async (req, res) => {
  try {
    const { courseId } = req.params;

    const records = await Attendance.findAll({
      where: { courseId },
      include: [
        { model: Student, as: "students" }, // through StudentAttendance
      ],
    });

   const now = new Date();

    const enhanced = records.map((attendance) => {
      const startTime = new Date(attendance.date);
      const expiresAt = new Date(startTime.getTime() + attendance.minutes * 60000);

      const status =
        now < startTime
          ? "UPCOMING"
          : now > expiresAt
          ? "CLOSED"
          : "OPEN";

      return {
        ...attendance.toJSON(),
        meta: { startTime, expiresAt, isExpired: now > expiresAt, status },
      };
    });

    res.json({ success: true, data: enhanced });
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------
// Get attendance for a student in a specific course
// ------------------------------
exports.getAttendanceForStudentCourse = async (req, res) => {
  try {
    const studentId = req.user.user_id; // student from JWT middleware
    const { courseId } = req.params;

    if (!courseId) throw { statusCode: 400, message: "courseId is required" };

    // Check if student is enrolled in the course
    const isEnrolled = await Enrollment.findOne({
      where: { studentId, courseId },
    });

    if (!isEnrolled)
      throw {
        statusCode: 403,
        message: "You are not enrolled in this course",
      };

    // Fetch attendance sessions + student's present/absent status
    const records = await StudentAttendance.findAll({
      where: { studentId },
      include: [
        {
          model: Attendance,
          as: "attendance",
          where: { courseId },
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const now = new Date();

    const enhanced = records.map((record) => {
      const attendance = record.attendance;

      const startTime = new Date(attendance.date);
      const expiresAt = new Date(startTime.getTime() + attendance.minutes * 60000);

      const status =
        now < startTime
          ? "UPCOMING"
          : now > expiresAt
          ? "CLOSED"
          : "OPEN";


      return {
        ...record.toJSON(),
        meta: { startTime, expiresAt, isExpired: now > expiresAt, status },
      };
    });

    res.json({
      success: true,
      courseId,
      totalSessions: enhanced.length,
      data: enhanced,
    });
  } catch (err) {
    handleError(res, err);
  }
};


exports.deleteAttendance = async (req, res) => {
  const transaction = await Attendance.sequelize.transaction();
  try {
    const { attendanceId } = req.params;

    if (!attendanceId) {
      throw { statusCode: 400, message: "attendanceId is required" };
    }

    const attendance = await Attendance.findByPk(attendanceId, { transaction });

    if (!attendance) {
      throw { statusCode: 404, message: "Attendance not found" };
    }

    await StudentAttendance.destroy({
      where: { attendanceId },
      transaction,
    });

    await attendance.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Attendance deleted successfully",
    });
  } catch (err) {
    await transaction.rollback();
    handleError(res, err);
  }
};
