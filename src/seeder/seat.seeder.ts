import { PrismaClient, Prisma } from '@prisma/client';
import { Seeder } from './base.seeder';

export class SeatSeeder implements Seeder {
  async seed(prisma: PrismaClient): Promise<void> {
    try {
      // Lấy tất cả venue có hasSeats = true
      const venues = await prisma.venue.findMany({
        where: {
          hasSeats: true,
          row: { gt: 0 },
          column: { gt: 0 },
        },
      });

      if (venues.length === 0) {
        console.log('No venues with seats found');
        return;
      }

      let totalSeatsCreated = 0;

      for (const venue of venues) {
        // Kiểm tra xem venue đã có seats chưa
        const existingSeatsCount = await prisma.seat.count({
          where: { venueId: venue.id },
        });

        if (existingSeatsCount > 0) {
          console.log(
            `Venue ${venue.name} (id: ${venue.id}) already has ${existingSeatsCount} seats, skipping`,
          );
          continue;
        }

        // Tạo ghế theo hàng và cột
        const seats: Prisma.SeatCreateManyInput[] = [];

        for (let row = 1; row <= venue.row; row++) {
          for (let col = 1; col <= venue.column; col++) {
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
          totalSeatsCreated += seats.length;
          console.log(
            `✅ Created ${seats.length} seats for venue ${venue.name} (id: ${venue.id})`,
          );
        }
      }

      console.log(
        `✅ SeatSeeder: Created ${totalSeatsCreated} seats across ${venues.length} venues`,
      );
    } catch (error) {
      console.error('❌ Error seeding seats:', error);
      throw error;
    }
  }
}
