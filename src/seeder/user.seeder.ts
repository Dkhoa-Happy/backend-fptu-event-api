import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import type { Seeder } from './base.seeder';

export class UserSeeder implements Seeder {
  async seed(prisma: PrismaClient): Promise<void> {
    const campus =
      (await prisma.campus.findFirst({
        where: { code: 'FU-HCM' },
      })) ?? (await prisma.campus.findFirst());

    if (!campus) {
      console.warn('No campus found, skip UserSeeder');
      return;
    }

    const password = '123456';
    const passwordHash = await argon2.hash(password);

    // Staff account
    await prisma.user.upsert({
      where: { email: 'staff@example.com' },
      update: {},
      create: {
        email: 'staff@example.com',
        userName: 'staff1',
        passwordHash,
        firstName: 'Staff',
        lastName: 'Account',
        avatar:
          'https://i.pinimg.com/1200x/18/55/ed/1855ed060a7a3f747a5b1110bb0b2f05.jpg',
        phoneNumber: '0900000001',
        address: 'FPT University - Hồ Chí Minh',
        gender: true, // male
        roleName: 'STAFF',
        campusId: campus.id,
        isActive: true,
      },
    });

    // Event organizer account
    await prisma.user.upsert({
      where: { email: 'organizer@example.com' },
      update: {},
      create: {
        email: 'organizer@example.com',
        userName: 'organizer1',
        passwordHash,
        firstName: 'Organizer',
        lastName: 'Account',
        avatar:
          'https://i.pinimg.com/736x/44/32/db/4432db7de6fb30a85a340882a5ca47f0.jpg',
        phoneNumber: '0900000002',
        address: 'FPT University - Hồ Chí Minh',
        gender: true, // male
        roleName: 'ORGANIZER',
        campusId: campus.id,
        isActive: true,
      },
    });

    // Student account
    await prisma.user.upsert({
      where: { email: 'student@example.com' },
      update: {},
      create: {
        email: 'student@example.com',
        userName: 'student1',
        passwordHash,
        firstName: 'Student',
        lastName: 'Account',
        avatar:
          'https://i.pinimg.com/1200x/5e/41/51/5e415107901e7b8e1dc74b39a829c215.jpg',
        phoneNumber: '0900000003',
        address: 'FPT University - Hồ Chí Minh',
        gender: false, // female
        roleName: 'STUDENT',
        campusId: campus.id,
        isActive: true,
      },
    });
    // Admin account
    await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        userName: 'admin1',
        passwordHash,
        firstName: 'Admin',
        lastName: 'Account',
        avatar:
          'https://i.pinimg.com/736x/5b/a3/5d/5ba35db9cb3f9f39cd1dc310c800d624.jpg',
        phoneNumber: '0900000000',
        address: 'FPT University - Hồ Chí Minh',
        gender: true, // male
        roleName: 'ADMIN',
        campusId: campus.id,
        isActive: true,
      },
    });
  }
}
