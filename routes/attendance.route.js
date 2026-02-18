const express = require("express");
const attendanceRouter = express.Router();
const { authenticate } = require("../middlewares/authenticator.middleware");
const { authorizeAdmin } = require("../middlewares/authorizeAdmin.middleware");
const {
  createAttendance,
  markAttendanceStudent,
  markAttendanceAdmin,
  getStudentAttendance,
  getCourseAttendance,
  getAttendanceForStudentCourse,
  deleteAttendance
} = require("../controllers/attendance.controller");

// Admin-only: create attendance
attendanceRouter.post("/", authenticate, authorizeAdmin, createAttendance);

// Get attendance for a course
attendanceRouter.get("/course/:courseId", authenticate,authorizeAdmin, getCourseAttendance);

// Student marks attendance (requires code)
attendanceRouter.post("/mark/student", authenticate, markAttendanceStudent);

// Admin marks or updates attendance
attendanceRouter.post("/mark/admin", authenticate, authorizeAdmin, markAttendanceAdmin);

// Get attendance for a student
attendanceRouter.get("/student/course/:courseId",authenticate,getAttendanceForStudentCourse);
attendanceRouter.get("/student/:studentId", authenticate, getStudentAttendance);

attendanceRouter.delete("/:attendanceId", authenticate, authorizeAdmin, deleteAttendance);





module.exports = attendanceRouter;
