'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Attendances');
    if (!table.minutes) {
      await queryInterface.addColumn('Attendances', 'minutes', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 120,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Attendances');
    if (table.minutes) {
      await queryInterface.removeColumn('Attendances', 'minutes');
    }
  }
};