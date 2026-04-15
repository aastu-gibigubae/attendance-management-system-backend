const promoteStudents = require("../utils/studentPromotion");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Student, ConfessionFather } = require("../models");
const {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  NODE_ENV,
} = require("../config/env.js");


// Error handler
const handleError = (res, err) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};

exports.manualPromotion = async (req, res) => {
  try {
    await promoteStudents();
    res.json({ success: true, message: "Student promotion completed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Promotion failed" });
  }
};

exports.signUp = async (req, res) => {
  try {
    let {
      first_name,
      father_name,
      grand_father_name,
      christian_name,
      id_number,
      email,
      password,
      gender,
      phone_number,
      department,
      year,
      dorm_block,
      room_number,
      confessionFatherId,
    } = req.body;

    // Required fields
    const requiredFields = [
      "first_name",
      "father_name",
      "grand_father_name",
      "id_number",
      "email",
      "password",
      "gender",
      "phone_number",
    ];
    for (const field of requiredFields) {
      if (!req.body[field])
        throw { statusCode: 400, message: `Missing required field: ${field}` };
    }
    email = email.toLowerCase();
    // Check duplicate email
    const existingStudent = await Student.findOne({ where: { email } });
    if (existingStudent)
      throw { statusCode: 400, message: "Student already exists" };

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Upload ID card
    if (!req.file)
      throw { statusCode: 400, message: "ID card image is required" };
    const id_card_image_path = await uploadToCloudinary(req.file, "id_card");

    // Create student
    const student = await Student.create({
      first_name,
      father_name,
      grand_father_name,
      christian_name,
      id_number,
      email,
      password: hashedPassword,
      gender,
      phone_number,
      department,
      year,
      dorm_block,
      room_number,
      id_card_image_path,
      role: "student",
      is_verified: false,
    });

    const token = jwt.sign(
      { user_id: student.id, email: student.email, role: student.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    const refreshToken = jwt.sign(
      { user_id: student.id, email: student.email, role: student.role },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );
    const ninetyDays = 1000 * 60 * 60 * 24 * 90;

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: NODE_ENV === "production" ? "none" : "lax",
      maxAge: ninetyDays,
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: NODE_ENV === "production" ? "none" : "lax",
      maxAge: ninetyDays,
    });

    res.status(201).json({
      success: true,
      data: {
        id: student.id,
        first_name: student.first_name,
        email: student.email,
        role: student.role,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
};

exports.createStudent = async (req, res) => {
  try {
    let {
      first_name,
      father_name,
      grand_father_name,
      christian_name,
      id_number,
      email,
      password,
      gender,
      phone_number,
      department,
      year,
      dorm_block,
      room_number,
      confessionFatherId,
    } = req.body;

    const requiredFields = [
      "first_name",
      "father_name",
      "grand_father_name",
      "id_number",
      "email",
      "password",
      "gender",
      "phone_number",
    ];

    for (const field of requiredFields) {
      if (!req.body[field]) {
        throw { statusCode: 400, message: `Missing required field: ${field}` };
      }
    }

    email = email.toLowerCase();

    const existingStudent = await Student.findOne({ where: { email } });
    if (existingStudent)
      throw { statusCode: 400, message: "Student already exists" };

    const hashedPassword = await bcrypt.hash(password, 10);

    if (!req.file)
      throw { statusCode: 400, message: "ID card image is required" };

    const id_card_image_path = await uploadToCloudinary(req.file, "id_card");

    const student = await Student.create({
      first_name,
      father_name,
      grand_father_name,
      christian_name,
      id_number,
      email,
      password: hashedPassword,
      gender,
      phone_number,
      department,
      year,
      dorm_block,
      room_number,
      id_card_image_path,
      role: "student",
      is_verified: true, 
    });

    res.status(201).json({
      success: true,
      message: "Student created successfully",
      data: student,
    });
  } catch (err) {
    handleError(res, err);
  }
};