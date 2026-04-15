const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Student, ConfessionFather } = require("../models");
const {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
} = require("../config/env.js");
  const ninetyDays = 1000 * 60 * 60 * 24 * 90;

// Error handler
const handleError = (res, err) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};

// Sign up
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
    const id_card_image_path = "undefined";

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


    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: "api.attendance.aastugibigubae.com",
      maxAge: ninetyDays,
      path: "/"
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: "aastugibigubae.com",
      maxAge: ninetyDays,
      path: "/"
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

// Sign in
exports.signIn = async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password)
      throw { statusCode: 400, message: "Missing email or password" };
    email = email.toLowerCase();
    const student = await Student.findOne({ where: { email } });
    if (!student) throw { statusCode: 404, message: "Student not found" };

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) throw { statusCode: 401, message: "Invalid credentials" };

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



    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: "api.attendance.aastugibigubae.com",
      maxAge: ninetyDays,
      path: "/"
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: "api.attendance.aastugibigubae.com",
      maxAge: ninetyDays,
      path: "/"
    });
    res.json({
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

// Logout
exports.logout = (req, res) => {
  // IMPORTANT: options must exactly match what was used in res.cookie() when setting
  // the token — otherwise the browser silently ignores the clear and the cookie survives.
  const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: "api.attendance.aastugibigubae.com",
      path: "/"
  };
  res.clearCookie("auth_token", cookieOptions);
  res.clearCookie("refresh_token", cookieOptions);
  res.json({ success: true, message: "Logged out successfully" });
};

// Refresh token
exports.refreshToken = (req, res) => {
  try {
    const refreshTokenCookie = req.cookies?.refresh_token;
    if (!refreshTokenCookie)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const decoded = jwt.verify(refreshTokenCookie, JWT_REFRESH_SECRET);
    const newToken = jwt.sign(
      { user_id: decoded.user_id, email: decoded.email, role: decoded.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.cookie("auth_token", newToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: ninetyDays,
      domain: "api.attendance.aastugibigubae.com",
      path: "/"
    });
    res.json({ success: true, message: "Token refreshed" });
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
};
