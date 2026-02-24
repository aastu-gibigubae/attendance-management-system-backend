const express = require("express");
const courseRouter = express.Router();
const courseController = require("../controllers/course.controller");

const { authenticate } = require("../middlewares/authenticator.middleware");
const { authorizeAdmin } = require("../middlewares/authorizeAdmin.middleware");

// Admin routes
courseRouter.post(
  "/",
  authenticate,
  authorizeAdmin,
  courseController.createCourse
);
courseRouter.get(
  "/students/:courseId",
  authenticate,
  authorizeAdmin,
  courseController.getStudentsInCourse
);
courseRouter.put(
  "/:id",
  authenticate,
  authorizeAdmin,
  courseController.updateCourse
);
courseRouter.delete(
  "/:id",
  authenticate,
  authorizeAdmin,
  courseController.deleteCourse
);
courseRouter.get(
  "/:courseId/search-students",
  authenticate,
  authorizeAdmin,
  courseController.searchStudentsForCourse
);

// Public/student routes
courseRouter.get("/", authenticate,courseController.getCourses);
courseRouter.get("/my", authenticate, courseController.getStudentCourses);
courseRouter.get("/:id", authenticate,courseController.getCourseById);

module.exports = courseRouter;
