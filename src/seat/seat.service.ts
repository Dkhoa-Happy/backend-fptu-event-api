import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSeatTypeDto, ToggleSeatStatusDto } from './dto';

@Injectable()
export class SeatService {
  constructor(private readonly prisma: PrismaService) {}

  async getSeatsByVenueId(venueId: number) {
    try {
      const venue = await this.prisma.venue.findUnique({
        where: { id: venueId },
      });
      if (!venue) {
        throw new BadRequestException('Venue không tồn tại');
      }

      const seats = await this.prisma.seat.findMany({
        where: { venueId },
        select: {
          id: true,
          rowLabel: true,
          colLabel: true,
          seatType: true,
          isActive: true,
          isBooked: true,
        },
        orderBy: [{ rowLabel: 'asc' }, { colLabel: 'asc' }],
      });

      return seats;
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi lấy danh sách ghế');
    }
  }

  async getSeatById(id: number) {
    try {
      const seat = await this.prisma.seat.findUnique({
        where: { id },
        select: {
          id: true,
          rowLabel: true,
          colLabel: true,
          seatType: true,
          isActive: true,
          venueId: true,
          isBooked: true,
        },
      });

      if (!seat) {
        throw new BadRequestException('Ghế không tồn tại');
      }

      return seat;
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi lấy thông tin ghế');
    }
  }

  async updateSeatType(id: number, dto: UpdateSeatTypeDto) {
    try {
      const seat = await this.prisma.seat.findUnique({
        where: { id },
      });

      if (!seat) {
        throw new BadRequestException('Ghế không tồn tại');
      }

      const updatedSeat = await this.prisma.seat.update({
        where: { id },
        data: {
          seatType: dto.seatType,
        },
      });

      return {
        message: 'Cập nhật loại ghế thành công',
        seat: updatedSeat,
      };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi cập nhật loại ghế');
    }
  }

  async toggleSeatStatus(id: number, dto: ToggleSeatStatusDto) {
    try {
      const seat = await this.prisma.seat.findUnique({
        where: { id },
      });

      if (!seat) {
        throw new BadRequestException('Ghế không tồn tại');
      }

      const updatedSeat = await this.prisma.seat.update({
        where: { id },
        data: {
          isActive: dto.isActive,
        },
      });

      return {
        message: `${dto.isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} ghế thành công`,
        seat: updatedSeat,
      };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi cập nhật trạng thái ghế');
    }
  }
}
