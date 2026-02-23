// migration file: 20260223000001-add_course_type_to_courses.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Courses', 'course_type', {
      type: Sequelize.ENUM('regular', 'event'),
      allowNull: false,
      defaultValue: 'regular'
    });

    await queryInterface.changeColumn('Courses', 'year_level', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.changeColumn('Courses', 'semester', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Courses', 'course_type');
 
    await queryInterface.changeColumn('Courses', 'year_level', {
      type: Sequelize.INTEGER,
      allowNull: false
    });

    await queryInterface.changeColumn('Courses', 'semester', {
      type: Sequelize.INTEGER,
      allowNull: false
    });

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Courses_course_type";');
  }
};