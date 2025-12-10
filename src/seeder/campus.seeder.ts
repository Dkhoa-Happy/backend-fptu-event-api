import { PrismaClient, Prisma } from '@prisma/client';
import type { Seeder } from './base.seeder';

export class CampusSeeder implements Seeder {
  async seed(prisma: PrismaClient): Promise<void> {
    const campuses: Prisma.CampusCreateManyInput[] = [
      {
        name: 'FU - Hòa Lạc',
        code: 'FU-HL',
        address: 'FPT University - Hòa Lạc',
        image:
          'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375022/428653189_787262210099440_3043567085344585742_n-650x488_kt7c69.jpg',
        status: 'Active',
      },
      {
        name: 'FU - Hồ Chí Minh',
        code: 'FU-HCM',
        address: 'FPT University - Hồ Chí Minh',
        image:
          'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375788/hcm_j0inds.jpg',
        status: 'Active',
      },
      {
        name: 'FU - Đà Nẵng',
        code: 'FU-DN',
        address: 'FPT University - Đà Nẵng',
        image:
          'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375022/428653189_787262210099440_3043567085344585742_n-650x488_kt7c69.jpg',
        status: 'Active',
      },
      {
        name: 'FU - Cần Thơ',
        code: 'FU-CT',
        address: 'FPT University - Cần Thơ',
        image:
          'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375387/SV_DH_FPT_giao_luu_chuyen-gia_tiktok_2-1024x768_mvaen3.jpg',
        status: 'Active',
      },
      {
        name: 'FU - Quy Nhơn',
        code: 'FU-QN',
        address: 'FPT University - Quy Nhơn',
        image:
          'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375625/DH-FPT-Quy-Nho%CC%9Bn-588x325_lk4waq.jpg',
        status: 'Active',
      },
    ];

    await prisma.campus.createMany({
      data: campuses,
      skipDuplicates: true,
    });
  }
}
