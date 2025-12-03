import { PrismaClient, Prisma } from '@prisma/client';
import type { Seeder } from './base.seeder';

export class CampusSeeder implements Seeder {
  async seed(prisma: PrismaClient): Promise<void> {
    const campuses: Prisma.CampusCreateManyInput[] = [
      {
        name: 'FU - Hòa Lạc',
        code: 'FU-HL',
        address: 'FPT University - Hòa Lạc',
        capacity: null,
      },
      {
        name: 'FU - Hồ Chí Minh',
        code: 'FU-HCM',
        address: 'FPT University - Hồ Chí Minh',
        capacity: null,
      },
      {
        name: 'FU - Đà Nẵng',
        code: 'FU-DN',
        address: 'FPT University - Đà Nẵng',
        capacity: null,
      },
      {
        name: 'FU - Cần Thơ',
        code: 'FU-CT',
        address: 'FPT University - Cần Thơ',
        capacity: null,
      },
      {
        name: 'FU - Quy Nhơn',
        code: 'FU-QN',
        address: 'FPT University - Quy Nhơn',
        capacity: null,
      },
    ];

    await prisma.campus.createMany({
      data: campuses,
      skipDuplicates: true,
    });
  }
}
