import { PrismaClient, UserStatus } from '@prisma/client';
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

    // Staff account 1
    await prisma.user.upsert({
      where: { email: 'staff@example.com' },
      update: { status: UserStatus.APPROVED },
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
        roleName: 'staff',
        campusId: campus.id,
        isActive: true,
        status: UserStatus.APPROVED,
      },
    });

    // Staff account 2
    await prisma.user.upsert({
      where: { email: 'staff2@example.com' },
      update: { status: UserStatus.APPROVED },
      create: {
        email: 'staff2@example.com',
        userName: 'staff2',
        passwordHash,
        firstName: 'Staff',
        lastName: 'Two',
        avatar:
          'https://i.pinimg.com/1200x/18/55/ed/1855ed060a7a3f747a5b1110bb0b2f05.jpg',
        phoneNumber: '0900000004',
        address: 'FPT University - Hồ Chí Minh',
        gender: false, // female
        roleName: 'staff',
        campusId: campus.id,
        isActive: true,
        status: UserStatus.APPROVED,
      },
    });

    // Staff account 3
    await prisma.user.upsert({
      where: { email: 'staff3@example.com' },
      update: { status: UserStatus.APPROVED },
      create: {
        email: 'staff3@example.com',
        userName: 'staff3',
        passwordHash,
        firstName: 'Staff',
        lastName: 'Three',
        avatar:
          'https://i.pinimg.com/1200x/18/55/ed/1855ed060a7a3f747a5b1110bb0b2f05.jpg',
        phoneNumber: '0900000005',
        address: 'FPT University - Hồ Chí Minh',
        gender: true, // male
        roleName: 'staff',
        campusId: campus.id,
        isActive: true,
        status: UserStatus.APPROVED,
      },
    });

    // Event organizer account
    await prisma.user.upsert({
      where: { email: 'organizer@example.com' },
      update: { status: UserStatus.APPROVED },
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
        roleName: 'event_organizer',
        campusId: campus.id,
        isActive: true,
        status: UserStatus.APPROVED,
      },
    });

    // Student accounts with student codes
    const studentAccounts = [
      {
        email: 'student@example.com',
        userName: 'student1',
        firstName: 'Student',
        lastName: 'Account',
        studentCode: 'SE182689',
        phoneNumber: '0900000003',
        gender: false, // female
      },
      {
        email: 'student2@example.com',
        userName: 'student2',
        firstName: 'Nguyễn',
        lastName: 'Văn A',
        studentCode: 'SE182690',
        phoneNumber: '0900000006',
        gender: true, // male
      },
      {
        email: 'student3@example.com',
        userName: 'student3',
        firstName: 'Trần',
        lastName: 'Thị B',
        studentCode: 'SE182691',
        phoneNumber: '0900000007',
        gender: false, // female
      },
      {
        email: 'student4@example.com',
        userName: 'student4',
        firstName: 'Lê',
        lastName: 'Văn C',
        studentCode: 'SE182692',
        phoneNumber: '0900000008',
        gender: true, // male
      },
      {
        email: 'student5@example.com',
        userName: 'student5',
        firstName: 'Phạm',
        lastName: 'Thị D',
        studentCode: 'SE182693',
        phoneNumber: '0900000009',
        gender: false, // female
      },
    ];

    for (const student of studentAccounts) {
      await prisma.user.upsert({
        where: { email: student.email },
        update: { status: UserStatus.APPROVED },
        create: {
          email: student.email,
          userName: student.userName,
          passwordHash,
          firstName: student.firstName,
          lastName: student.lastName,
          studentCode: student.studentCode,
          avatar:
            'https://i.pinimg.com/1200x/5e/41/51/5e415107901e7b8e1dc74b39a829c215.jpg',
          phoneNumber: student.phoneNumber,
          address: 'FPT University - Hồ Chí Minh',
          gender: student.gender,
          roleName: 'student',
          campusId: campus.id,
          isActive: true,
          status: UserStatus.APPROVED,
        },
      });
    }
    // Admin account
    await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: { status: UserStatus.APPROVED },
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
        roleName: 'admin',
        campusId: campus.id,
        isActive: true,
        status: UserStatus.APPROVED,
      },
    });
  }
}
