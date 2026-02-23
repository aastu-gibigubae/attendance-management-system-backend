module.exports = (sequelize, DataTypes) => {
  const Course = sequelize.define("Course", {
    course_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    course_type: {
      type: DataTypes.ENUM('regular', 'event'),
      allowNull: false,
      defaultValue: 'regular'
    },
    year_level: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        isInt: true,
        min: 1,
        max: 5
      }
    },
    semester: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        isInt: true,
        min: 1,
        max: 2
      }
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    enrollment_start_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    enrollment_deadline: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: "Courses",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

     validate: {
      regularCourseValidation() {
        if (this.course_type === 'regular') {
          if (!this.year_level) {
            throw new Error('Year level is required for regular courses');
          }
          if (!this.semester) {
            throw new Error('Semester is required for regular courses');
          }
        }
      }
    }
  });

  Course.associate = (models) => {
    // One course has many attendance sessions
    Course.hasMany(models.Attendance, {
      as: "sessions",
      foreignKey: "courseId",
      onDelete: "CASCADE",
      hooks: true,
    });

    // One course has many enrollments
    Course.hasMany(models.Enrollment, {
      as: "enrollments",
      foreignKey: "courseId",
      onDelete: "CASCADE",
      hooks: true,
    });
  };

  return Course;
};
