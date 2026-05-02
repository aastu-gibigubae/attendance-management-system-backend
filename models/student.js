const DEPARTMENTS = [
  "Electromechanical Engineering",
  "Chemical Engineering",
  "Software Engineering",
  "Mechanical Engineering",
  "Electrical and Computer Engineering",
  "Civil Engineering",
  "Architecture",
  "Environmental Engineering",
  "Geology",
  "Industrial Chemistry",
  "Applied Science",
  "Freshman Engineering",
  "Biotechnology",
  "Industrial Chemistry",
  "Mining",
  "Food Science",
  "Postgraduate",
  "Other"
];

module.exports = (sequelize, DataTypes) => {
  const Student = sequelize.define("Student", {
    first_name: { type: DataTypes.STRING, allowNull: false },
    father_name: { type: DataTypes.STRING, allowNull: false },
    grand_father_name: { type: DataTypes.STRING, allowNull: false },
    christian_name: { type: DataTypes.STRING, allowNull: true },
    confessionFatherId: {type: DataTypes.INTEGER,allowNull: true,
      references: {model: "ConfessionFathers",key: "id",},
      onDelete: "SET NULL",
    },
    id_number: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    gender: { type: DataTypes.ENUM("male", "female"), allowNull: false },
    phone_number: { type: DataTypes.STRING(15), allowNull: false },
    id_card_image_path: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM("student", "admin"), defaultValue: "student" },
    is_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_graduated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Academic info fields
    department: { type: DataTypes.ENUM(...DEPARTMENTS), allowNull: true },
    year: { type: DataTypes.INTEGER, allowNull: true },
    dorm_block: { type: DataTypes.INTEGER, allowNull: true },
    room_number: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: "Students",
    timestamps: true,
    updatedAt: "updated_at",
    createdAt: "created_at",
  });

  Student.associate = (models) => {
    // Attendance many-to-many
    Student.belongsToMany(models.Attendance, {
      through: models.StudentAttendance,
      as: "attendances",
      foreignKey: "studentId",
    });

    // Enrollment one-to-many
    Student.hasMany(models.Enrollment, { as: "enrollments", foreignKey: "studentId" });

    // Confession Father many-to-one
    Student.belongsTo(models.ConfessionFather, {
      as: "confession_father",
      foreignKey: "confessionFatherId",
    });
  };

  return Student;
};
