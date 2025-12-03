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
        capacity: true,
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
          capacity: true,
          hasSeats: true,
          mapImageUrl: true,
          status: true,
          campusId: true,
          seats: {
            select: {
              id: true,
              rowLabel: true,
              numberLabel: true,
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
    const { name, location, capacity, hasSeats, mapImageUrl, campusId } = venue;
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
          capacity,
          hasSeats,
          mapImageUrl,
          campusId,
          status: 'Active',
        },
      });
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
    const { name, location, capacity, hasSeats, mapImageUrl, campusId } = venue;
    try {
      const existingVenue = await this.prisma.venue.findUnique({
        where: { id },
      });
      if (!existingVenue) {
        throw new BadRequestException('Venue không tồn tại');
      }

      // Check if campus exists
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
          capacity,
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
