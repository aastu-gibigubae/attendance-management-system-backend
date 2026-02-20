'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Attendances', 'minutes', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 120,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Attendances', 'minutes');
  }
};