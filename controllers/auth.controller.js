const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Student } = require("../models");
const {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
} = require("../config/env.js");

const ninetyDays = 1000 * 60 * 60 * 24 * 90;

/**
 * 🔥 ALL POSSIBLE DOMAINS (CRITICAL FIX)
 */
const COOKIE_DOMAINS = [
  ".aastugibigubae.com",
  "api.attendance.aastugibigubae.com",
  "attendance.aastugibigubae.com",
];

/**
 * Central cookie config (main domain)
 */
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  domain: ".aastugibigubae.com",
  path: "/",
  maxAge: ninetyDays,
};

/**
 * 🔥 HARD COOKIE CLEANER (IMPORTANT)
 * Removes ALL possible stale cookies across domains
 */
const clearAllCookies = (res) => {
  for (const domain of COOKIE_DOMAINS) {
    res.clearCookie("auth_token", { domain, path: "/" });
    res.clearCookie("refresh_token", { domain, path: "/" });
  }
};

/**
 * Error handler
 */
const handleError = (res, err) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};

/**
 * SIGN UP
 */
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

    const existing = await Student.findOne({ where: { email } });
    if (existing) {
      throw { statusCode: 400, message: "Student already exists" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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
      role: "student",
      is_verified: false,
    });

    const token = jwt.sign(
      { user_id: student.id, email: student.email, role: student.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    const refreshToken = jwt.sign(
      { user_id: student.id, email: student.email, role: student.role },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN },
    );

    // 🔥 SAFETY: wipe ALL possible old sessions
    clearAllCookies(res);

    res.cookie("auth_token", token, cookieOptions);
    res.cookie("refresh_token", refreshToken, cookieOptions);

    return res.status(201).json({
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

/**
 * SIGN IN
 */
exports.signIn = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      throw { statusCode: 400, message: "Missing email or password" };
    }

    email = email.toLowerCase();

    const student = await Student.findOne({ where: { email } });
    if (!student) {
      throw { statusCode: 404, message: "Student not found" };
    }

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      throw { statusCode: 401, message: "Invalid credentials" };
    }

    const token = jwt.sign(
      { user_id: student.id, email: student.email, role: student.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    const refreshToken = jwt.sign(
      { user_id: student.id, email: student.email, role: student.role },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN },
    );

    // 🔥 CRITICAL: remove ALL old sessions first
    clearAllCookies(res);

    res.cookie("auth_token", token, cookieOptions);
    res.cookie("refresh_token", refreshToken, cookieOptions);
    console.log("LOGIN HIT:", email);
    console.log("USER FOUND:", student.role);
    return res.json({
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

/**
 * LOGOUT
 */
exports.logout = (req, res) => {
  // 🔥 HARD RESET EVERYTHING (ALL DOMAINS)
  clearAllCookies(res);

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

/**
 * REFRESH TOKEN
 */
exports.refreshToken = (req, res) => {
  try {
    const token = req.cookies?.refresh_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No refresh token",
      });
    }

    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);

    const newAccessToken = jwt.sign(
      {
        user_id: decoded.user_id,
        email: decoded.email,
        role: decoded.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.cookie("auth_token", newAccessToken, cookieOptions);

    return res.json({
      success: true,
      message: "Token refreshed",
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
};
