import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVenueDto, UpdateVenueDto } from './dto';

@Injectable()
export class VenueService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: string) {
    // Normalize status: convert "Active" -> "ACTIVE", "Inactive" -> "INACTIVE"
    let normalizedStatus: string | undefined;
    if (status) {
      const lowerStatus = status.toLowerCase();
      if (lowerStatus === 'active') {
        normalizedStatus = 'ACTIVE';
      } else if (lowerStatus === 'inactive') {
        normalizedStatus = 'INACTIVE';
      } else {
        // If status doesn't match, use as-is (case-insensitive search)
        normalizedStatus = status.toUpperCase();
      }
    }

    return this.prisma.venue.findMany({
      where: normalizedStatus ? { status: normalizedStatus } : undefined,
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
              isBooked: true,
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

      // Nếu hasSeats là false, force row và column về 0
      const finalRow = hasSeats ? row : 0;
      const finalColumn = hasSeats ? column : 0;

      // Nếu hasSeats là true, validate row và column phải > 0
      if (hasSeats && (row <= 0 || column <= 0)) {
        throw new BadRequestException(
          'Khi venue có ghế (hasSeats = true), số hàng và số cột phải lớn hơn 0',
        );
      }

      const response = await this.prisma.venue.create({
        data: {
          name,
          location,
          row: finalRow,
          column: finalColumn,
          hasSeats,
          mapImageUrl,
          campusId,
          status: 'ACTIVE',
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
          isBooked: boolean;
          venueId: number;
        }>;

        for (let r = 1; r <= row; r++) {
          for (let c = 1; c <= column; c++) {
            seats.push({
              rowLabel: String.fromCharCode(64 + r), // A, B, C, ...
              colLabel: c,
              seatType: 'standard',
              isActive: true,
              isBooked: false,
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

  async updateVenue(id: number, venue: UpdateVenueDto) {
    const { name, location, mapImageUrl } = venue;
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
          name,
          location,
          mapImageUrl,
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
          status: 'INACTIVE',
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
