import { PrismaClient, Prisma } from '@prisma/client';
import type { Seeder } from './base.seeder';

export class VenueSeeder implements Seeder {
  async seed(prisma: PrismaClient): Promise<void> {
    try {
      // Lấy tất cả các campus
      const campuses = await prisma.campus.findMany({
        select: { id: true, code: true, name: true },
      });

      if (campuses.length === 0) {
        console.warn('No campuses found, skip VenueSeeder');
        return;
      }

      // Định nghĩa venue cho mỗi campus (ít nhất 2 venue mỗi campus)
      const venuesData = [
        // FU-HL (Hòa Lạc)
        {
          name: 'FU HL - Hội trường lớn',
          location: 'FPT University Hòa Lạc - Tòa nhà Alpha',
          row: 15,
          column: 20,
          hasSeats: true,
          mapImageUrl:
            'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375022/428653189_787262210099440_3043567085344585742_n-650x488_kt7c69.jpg',
          campusCode: 'FU-HL',
        },
        {
          name: 'FU HL - Phòng họp A',
          location: 'FPT University Hòa Lạc - Tòa nhà Beta',
          row: 8,
          column: 10,
          hasSeats: true,
          mapImageUrl:
            'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375065/428653189_787262210099440_3043567085344585742_n-650x488_hhisdo.jpg',
          campusCode: 'FU-HL',
        },
        {
          name: 'FU HL - Sân khấu ngoài trời',
          location: 'FPT University Hòa Lạc - Sân vận động',
          row: 0,
          column: 0,
          hasSeats: false,
          mapImageUrl:
            'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375065/428653189_787262210099440_3043567085344585742_n-650x488_hhisdo.jpg',
          campusCode: 'FU-HL',
        },
        // FU-HCM (Hồ Chí Minh)
        {
          name: 'FU HCM Hall A',
          location: 'FPT University Hồ Chí Minh - Tòa nhà A',
          row: 10,
          column: 10,
          hasSeats: true,
          mapImageUrl:
            'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375201/546969190_758650040324615_3150035516932545546_n_od4xol.jpg',
          campusCode: 'FU-HCM',
        },
        {
          name: 'FU HCM Hall B',
          location: 'FPT University Hồ Chí Minh - Tòa nhà B',
          row: 12,
          column: 15,
          hasSeats: true,
          mapImageUrl:
            'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375248/SV_DH_FPT_giao_luu_chuyen-gia_tiktok_2-1024x768_j42qkw.jpg',
          campusCode: 'FU-HCM',
        },
        {
          name: 'FU HCM - Phòng đa năng',
          location: 'FPT University Hồ Chí Minh - Tòa nhà C',
          row: 0,
          column: 0,
          hasSeats: false,
          mapImageUrl:
            'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375304/FU-HCM-5_psjqnf.jpg',
          campusCode: 'FU-HCM',
        },
        // FU-DN (Đà Nẵng)
        {
          name: 'FU DN - Hội trường chính',
          location: 'FPT University Đà Nẵng - Tòa nhà Innovation',
          row: 10,
          column: 12,
          hasSeats: true,
          mapImageUrl:
            'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375387/SV_DH_FPT_giao_luu_chuyen-gia_tiktok_2-1024x768_mvaen3.jpg',
          campusCode: 'FU-DN',
        },
        {
          name: 'FU DN - Phòng hội thảo',
          location: 'FPT University Đà Nẵng - Tòa nhà Tech',
          row: 6,
          column: 8,
          hasSeats: true,
          mapImageUrl:
            'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375431/ht_drjemq.jpg',
          campusCode: 'FU-DN',
        },
        {
          name: 'FU DN - Sảnh sự kiện',
          location: 'FPT University Đà Nẵng - Lobby chính',
          row: 0,
          column: 0,
          hasSeats: false,
          mapImageUrl:
            'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375431/ht_drjemq.jpg',
          campusCode: 'FU-DN',
        },
        // FU-CT (Cần Thơ)
        {
          name: 'FU CT - Hội trường lớn',
          location: 'FPT University Cần Thơ - Tòa nhà Delta',
          row: 8,
          column: 10,
          hasSeats: true,
          mapImageUrl:
            'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375518/ct_qlykan.jpg',
          campusCode: 'FU-CT',
        },
        {
          name: 'FU CT - Phòng họp lớn',
          location: 'FPT University Cần Thơ - Tòa nhà Gamma',
          row: 5,
          column: 6,
          hasSeats: true,
          mapImageUrl:
            'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375518/ct_qlykan.jpg',
          campusCode: 'FU-CT',
        },
        // FU-QN (Quy Nhơn)
        {
          name: 'FU QN - Hội trường',
          location: 'FPT University Quy Nhơn - Tòa nhà chính',
          row: 10,
          column: 12,
          hasSeats: true,
          mapImageUrl:
            'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375625/DH-FPT-Quy-Nho%CC%9Bn-588x325_lk4waq.jpg',
          campusCode: 'FU-QN',
        },
        {
          name: 'FU QN - Phòng đa chức năng',
          location: 'FPT University Quy Nhơn - Tòa nhà phụ',
          row: 0,
          column: 0,
          hasSeats: false,
          mapImageUrl:
            'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765375625/DH-FPT-Quy-Nho%CC%9Bn-588x325_lk4waq.jpg',
          campusCode: 'FU-QN',
        },
      ];

      let createdCount = 0;
      let skippedCount = 0;

      for (const venueData of venuesData) {
        const campus = campuses.find((c) => c.code === venueData.campusCode);
        if (!campus) {
          console.warn(
            `Campus ${venueData.campusCode} not found, skip venue ${venueData.name}`,
          );
          skippedCount++;
          continue;
        }

        // Kiểm tra xem venue đã tồn tại chưa (theo tên và campus)
        const existing = await prisma.venue.findFirst({
          where: {
            name: venueData.name,
            campusId: campus.id,
          },
        });

        if (existing) {
          skippedCount++;
          continue;
        }

        // Tạo venue
        const venue = await prisma.venue.create({
          data: {
            name: venueData.name,
            location: venueData.location,
            row: venueData.row,
            column: venueData.column,
            hasSeats: venueData.hasSeats,
            mapImageUrl: venueData.mapImageUrl,
            campusId: campus.id,
            status: 'ACTIVE',
          },
        });

        // Nếu venue có seats, tạo seats
        if (venueData.hasSeats && venueData.row > 0 && venueData.column > 0) {
          const seats: Prisma.SeatCreateManyInput[] = [];
          for (let row = 1; row <= venueData.row; row++) {
            for (let col = 1; col <= venueData.column; col++) {
              seats.push({
                rowLabel: String.fromCharCode(64 + row), // A, B, C, ...
                colLabel: col,
                seatType: 'standard',
                isActive: true,
                isBooked: false,
                venueId: venue.id,
              });
            }
          }

          if (seats.length > 0) {
            await prisma.seat.createMany({
              data: seats,
              skipDuplicates: true,
            });
          }
        }

        createdCount++;
      }

      console.log(
        `✅ VenueSeeder: Created ${createdCount} venues, skipped ${skippedCount} existing venues`,
      );
    } catch (error) {
      console.error('❌ Error seeding venues:', error);
      throw error;
    }
  }
}
