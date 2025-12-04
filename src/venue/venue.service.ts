import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVenueDto } from './dto';

@Injectable()
export class VenueService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: string) {
    return this.prisma.venue.findMany({
      where: status ? { status } : undefined,
      select: {
        id: true,
        name: true,
        location: true,
        row: true,
        column: true,
        hasSeats: true,
        mapImageUrl: true,
        status: true,
        campusId: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  async getVenueById(id: number) {
    try {
      const venue = await this.prisma.venue.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          location: true,
          hasSeats: true,
          mapImageUrl: true,
          status: true,
          campusId: true,
          seats: {
            select: {
              id: true,
              rowLabel: true,
              colLabel: true,
              seatType: true,
              isActive: true,
            },
          },
        },
      });
      if (!venue) {
        throw new BadRequestException('Venue không tồn tại');
      }
      return venue;
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi lấy venue');
    }
  }

  async createVenue(venue: CreateVenueDto) {
    const { name, location, row, column, hasSeats, mapImageUrl, campusId } =
      venue;
    try {
      // Check if campus exists
      const campus = await this.prisma.campus.findUnique({
        where: { id: campusId },
      });
      if (!campus) {
        throw new BadRequestException('Campus không tồn tại');
      }

      const response = await this.prisma.venue.create({
        data: {
          name,
          location,
          row,
          column,
          hasSeats,
          mapImageUrl,
          campusId,
          status: 'Active',
        },
      });
      // Nếu venue có seats (hasSeats true) và số hàng, cột hợp lệ thì tạo tất cả seats
      if (
        hasSeats &&
        typeof row === 'number' &&
        typeof column === 'number' &&
        row > 0 &&
        column > 0
      ) {
        const seats = [] as Array<{
          rowLabel: string;
          colLabel: number;
          seatType: string;
          isActive: boolean;
          venueId: number;
        }>;

        for (let r = 1; r <= row; r++) {
          for (let c = 1; c <= column; c++) {
            seats.push({
              rowLabel: String.fromCharCode(64 + r), // A, B, C, ...
              colLabel: c,
              seatType: 'standard',
              isActive: true,
              venueId: response.id,
            });
          }
        }

        // createMany
        if (seats.length > 0) {
          await this.prisma.seat.createMany({ data: seats });
        }
      }

      return { message: 'Tạo venue thành công', venue: response };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi tạo venue');
    }
  }

  async updateVenue(id: number, venue: CreateVenueDto) {
    const { name, location, hasSeats, mapImageUrl, campusId } = venue;
    try {
      const existingVenue = await this.prisma.venue.findUnique({
        where: { id },
      });
      if (!existingVenue) {
        throw new BadRequestException('Venue không tồn tại');
      }

      const campus = await this.prisma.campus.findUnique({
        where: { id: campusId },
      });
      if (!campus) {
        throw new BadRequestException('Campus không tồn tại');
      }

      const response = await this.prisma.venue.update({
        where: { id },
        data: {
          name,
          location,
          hasSeats,
          mapImageUrl,
          campusId,
        },
      });
      return { message: 'Cập nhật venue thành công', venue: response };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi cập nhật venue');
    }
  }

  async deleteVenueById(id: number) {
    try {
      const existingVenue = await this.prisma.venue.findUnique({
        where: { id },
      });
      if (!existingVenue) {
        throw new BadRequestException('Venue không tồn tại');
      }
      const response = await this.prisma.venue.update({
        where: { id },
        data: {
          status: 'Inactive',
        },
      });
      return { message: 'Xóa venue thành công', venue: response };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi xóa venue');
    }
  }
}
