import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSeatTypeDto, ToggleSeatStatusDto } from './dto';

@Injectable()
export class SeatService {
  constructor(private readonly prisma: PrismaService) {}

  async getSeatsByVenueId(venueId: number, eventId?: string) {
    try {
      const venue = await this.prisma.venue.findUnique({
        where: { id: venueId },
      });
      if (!venue) {
        throw new BadRequestException('Venue không tồn tại');
      }

      // Nếu có eventId, validate event tồn tại
      if (eventId) {
        const event = await this.prisma.event.findUnique({
          where: { id: eventId },
          select: { id: true, venueId: true },
        });

        if (!event) {
          throw new BadRequestException(`Event với ID ${eventId} không tồn tại`);
        }

        if (event.venueId !== venueId) {
          throw new BadRequestException(
            `Event không thuộc venue này. Event thuộc venue ID ${event.venueId}, nhưng đang query venue ID ${venueId}`,
          );
        }
      }

      const seats = await this.prisma.seat.findMany({
        where: { venueId },
        select: {
          id: true,
          rowLabel: true,
          colLabel: true,
          seatType: true,
          isActive: true,
          isBooked: true, // Giữ field này để backward compatibility
        },
        orderBy: [{ rowLabel: 'asc' }, { colLabel: 'asc' }],
      });

      // Nếu có eventId, tính toán isBooked động dựa trên Ticket của event đó
      if (eventId) {
        // Lấy tất cả ticket đã book ghế cho event này (chỉ VALID và USED, không tính CANCELLED và EXPIRED)
        const bookedTickets = await this.prisma.ticket.findMany({
          where: {
            eventId: eventId,
            seatId: { not: null },
            status: {
              notIn: ['CANCELLED', 'EXPIRED'],
            },
          },
          select: {
            seatId: true,
          },
        });

        const bookedSeatIds = new Set(
          bookedTickets.map((t) => t.seatId).filter((id): id is number => id !== null),
        );

        // Map lại seats với isBooked được tính động
        return seats.map((seat) => ({
          ...seat,
          isBooked: bookedSeatIds.has(seat.id),
        }));
      }

      // Nếu không có eventId, trả về isBooked từ database (cho admin view)
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
