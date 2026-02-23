// migration file: 20260223000001-add_course_type_to_courses.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Courses');

    // Add course_type only if it doesn't exist
    if (!table.course_type) {
      await queryInterface.addColumn('Courses', 'course_type', {
        type: Sequelize.ENUM('regular', 'event'),
        allowNull: false,
        defaultValue: 'regular'
      });
    }

    // Change year_level only if currently NOT nullable
    if (table.year_level && table.year_level.allowNull === false) {
      await queryInterface.changeColumn('Courses', 'year_level', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }

    // Change semester only if currently NOT nullable
    if (table.semester && table.semester.allowNull === false) {
      await queryInterface.changeColumn('Courses', 'semester', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Courses');

    // Remove course_type only if it exists
    if (table.course_type) {
      await queryInterface.removeColumn('Courses', 'course_type');
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_Courses_course_type";'
      );
    }

    // Revert year_level to NOT NULL if currently nullable
    if (table.year_level && table.year_level.allowNull === true) {
      await queryInterface.changeColumn('Courses', 'year_level', {
        type: Sequelize.INTEGER,
        allowNull: false
      });
    }

    // Revert semester to NOT NULL if currently nullable
    if (table.semester && table.semester.allowNull === true) {
      await queryInterface.changeColumn('Courses', 'semester', {
        type: Sequelize.INTEGER,
        allowNull: false
      });
    }
  }
};