const express = require('express');
const multer = require("multer");
const { authenticate } = require('../middlewares/authenticator.middleware');
const { authorizeAdmin } = require('../middlewares/authorizeAdmin.middleware');
const { manualPromotion,createStudent } = require("../controllers/adminController");

const adminRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

adminRouter.post(
  '/promote-students',
  authenticate,
  authorizeAdmin,
  manualPromotion 
);

adminRouter.post(
  "/register_student", 
  upload.single("id_card"),
  authenticate, 
  authorizeAdmin, 
  createStudent
);

module.exports = adminRouter;
