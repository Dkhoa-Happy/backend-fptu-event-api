import { PrismaClient, Prisma } from '@prisma/client';
import { Seeder } from './base.seeder';

export class SeatSeeder implements Seeder {
  async seed(prisma: PrismaClient): Promise<void> {
    try {
      // Lấy venue với id = 1
      const venue = await prisma.venue.findUnique({
        where: { id: 1 },
      });

      if (!venue) {
        console.log('Venue with id 1 not found');
        return;
      }

      // Xóa các ghế cũ của venue 1 nếu có
      await prisma.seat.deleteMany({
        where: { venueId: 1 },
      });

      // Tạo ghế theo hàng và cột
      const numRows = venue.row;
      const numColumns = venue.column;
      const seats: Prisma.SeatCreateManyInput[] = [];

      for (let row = 1; row <= numRows; row++) {
        for (let col = 1; col <= numColumns; col++) {
          seats.push({
            rowLabel: String.fromCharCode(64 + row), // A, B, C, ...
            colLabel: col,
            seatType: 'standard',
            isActive: true,
            venueId: 1,
          });
        }
      }

      // Chỉ tạo 100 ghế đầu tiên
      const seatsToCreate = seats.slice(0, 100);

      await prisma.seat.createMany({
        data: seatsToCreate,
      });

      console.log(`✅ Seeded ${seatsToCreate.length} seats for venue 1`);
    } catch (error) {
      console.error('❌ Error seeding seats:', error);
      throw error;
    }
  }
}
