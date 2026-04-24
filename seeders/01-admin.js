'use strict';

const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash('5cy7:#We0Yft', 12);

    await queryInterface.bulkInsert('Students', [
      {
        first_name: 'Super',
        father_name: 'Admin',
        grand_father_name: 'User',
        christian_name: 'None',
        id_number: 'ADMIN001',
        email: 'admin@gmail.com',
        password: hashedPassword,
        gender: 'male',
        phone_number: '0911111111',
        department: null,
        year: null,
        dorm_block: null,
        room_number: null,
        id_card_image_path: 'undefined',
        role: 'admin',
        is_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    console.log('✅ Super Admin created: admin@gmail.com / 12345678');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Students', {
      email: 'admin@gmail.com',
    });
  },
};