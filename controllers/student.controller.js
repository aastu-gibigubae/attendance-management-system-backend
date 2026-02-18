const { Student } = require("../models");
const bcrypt = require("bcrypt");

const { Op } = require("sequelize");
const handleError = (res, err) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};

exports.getAllStudents = async (req, res) => {
  try {
    const students = await Student.findAll();
    res.json({ success: true, data: students });
  } catch (err) {
    handleError(res, err);
  }
};


exports.updateStudentByAdmin = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findByPk(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const allowedFields = [
      "first_name",
      "father_name",
      "grand_father_name",
      "christian_name",
      "email",
      "phone_number",
      "department",
      "year",
      "dorm_block",
      "room_number",
      "is_verified",
      "password", 
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.email) {
      updates.email = updates.email.toLowerCase();
    }

    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    await student.update(updates);

    res.json({
      success: true,
      message: "Student updated successfully",
      data: {
        id: student.id,
        first_name: student.first_name,
        email: student.email,
        is_verified: student.is_verified,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
};

exports.updateOwnProfile = async (req, res) => {
  try {
    const student = await Student.findByPk(req.user.user_id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const allowedFields = [
      "first_name",
      "father_name",
      "grand_father_name",
      "christian_name",
      "email",
      "password",
      "phone_number",
      "department",
      "year",
      "dorm_block",
      "room_number",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.email) {
      updates.email = updates.email.toLowerCase();
    }

    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    await student.update(updates);

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: student.id,
        first_name: student.first_name,
        email: student.email,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
};

exports.deleteStudentByAdmin = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findByPk(studentId);
    if (!student)
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });

    await student.destroy();

    res.json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (err) {
    handleError(res, err);
  }
};

exports.deleteOwnAccount = async (req, res) => {
  try {
    const student = await Student.findByPk(req.user.user_id);

    if (!student)
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });

    await student.destroy();

    res.json({
      success: true,
      message: "Your account has been deleted",
    });
  } catch (err) {
    handleError(res, err);
  }
};

exports.searchStudents = async (req, res) => {
  try {


    const { keyword } = req.params;

    const students = await Student.findAll({
      where: {
        [Op.or]: [
          { first_name: { [Op.like]: `%${keyword}%` } },
          { father_name: { [Op.like]: `%${keyword}%` } },
          { grand_father_name: { [Op.like]: `%${keyword}%` } },
          { christian_name: { [Op.like]: `%${keyword}%` } },
          { email: { [Op.like]: `%${keyword}%` } },
          { phone_number: { [Op.like]: `%${keyword}%` } },
          { id_number: { [Op.like]: `%${keyword}%` } },
        ],
      },
    });

    res.json({ success: true, data: students });
  } catch (err) {
    handleError(res, err);
  }
};



exports.getMyProfile = async (req, res) => {
  const studentId = req.user.id;

  const student = await Student.findByPk(req.user.user_id);

  res.json({ success: true, data: student });
};
