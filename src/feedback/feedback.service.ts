import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto, UpdateFeedbackDto } from './dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async createFeedback(dto: CreateFeedbackDto, userId: number) {
    try {
      // Kiểm tra sự kiện có tồn tại không
      const event = await this.prisma.event.findUnique({
        where: { id: dto.eventId },
      });

      if (!event) {
        throw new NotFoundException('Sự kiện không tồn tại');
      }

      // Kiểm tra thời gian nếu không bỏ qua validation
      if (!dto.skipTimeValidation) {
        const now = new Date();
        const eventEndTime = new Date(event.endTime);
        // Tính thời gian 30 phút trước khi sự kiện kết thúc
        const thirtyMinutesBeforeEnd = new Date(
          eventEndTime.getTime() - 30 * 60 * 1000,
        );

        // Kiểm tra: chỉ cho phép feedback khi sự kiện đã kết thúc hoặc sắp kết thúc (trong 30 phút cuối)
        if (now < thirtyMinutesBeforeEnd) {
          throw new BadRequestException(
            'Chỉ có thể đánh giá sự kiện khi sự kiện sắp kết thúc hoặc đã kết thúc',
          );
        }
      }

      // Kiểm tra user đã tham gia sự kiện chưa (có ticket)
      const ticket = await this.prisma.ticket.findFirst({
        where: {
          userId,
          eventId: dto.eventId,
        },
      });

      if (!ticket) {
        throw new BadRequestException('Bạn chưa đăng ký tham gia sự kiện này');
      }

      // Kiểm tra user đã feedback chưa
      const existingFeedback = await this.prisma.feedback.findFirst({
        where: {
          userId,
          eventId: dto.eventId,
        },
      });

      if (existingFeedback) {
        throw new BadRequestException('Bạn đã đánh giá sự kiện này rồi');
      }

      const feedback = await this.prisma.feedback.create({
        data: {
          rating: dto.rating,
          comment: dto.comment,
          eventId: dto.eventId,
          userId,
        },
        include: {
          user: {
            select: {
              id: true,
              userName: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      return {
        message: 'Tạo feedback thành công',
        feedback,
      };
    } catch (error: unknown) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi tạo feedback');
    }
  }

  async getFeedbacksByEventId(eventId: string) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new NotFoundException('Sự kiện không tồn tại');
      }

      const feedbacks = await this.prisma.feedback.findMany({
        where: { eventId },
        include: {
          user: {
            select: {
              id: true,
              userName: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Tính rating trung bình
      const totalRating = feedbacks.reduce((sum, fb) => sum + fb.rating, 0);
      const averageRating =
        feedbacks.length > 0 ? totalRating / feedbacks.length : 0;

      return {
        feedbacks,
        statistics: {
          total: feedbacks.length,
          averageRating: Math.round(averageRating * 10) / 10, // Làm tròn 1 chữ số thập phân
        },
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi lấy danh sách feedback');
    }
  }

  async getFeedbackById(id: number) {
    try {
      const feedback = await this.prisma.feedback.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              userName: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              description: true,
            },
          },
        },
      });

      if (!feedback) {
        throw new NotFoundException('Feedback không tồn tại');
      }

      return feedback;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi lấy feedback');
    }
  }

  async updateFeedback(id: number, dto: UpdateFeedbackDto, userId: number) {
    try {
      const feedback = await this.prisma.feedback.findUnique({
        where: { id },
      });

      if (!feedback) {
        throw new NotFoundException('Feedback không tồn tại');
      }

      // Kiểm tra quyền sở hữu
      if (feedback.userId !== userId) {
        throw new BadRequestException(
          'Bạn không có quyền cập nhật feedback này',
        );
      }

      const updatedFeedback = await this.prisma.feedback.update({
        where: { id },
        data: {
          rating: dto.rating,
          comment: dto.comment,
        },
        include: {
          user: {
            select: {
              id: true,
              userName: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      return {
        message: 'Cập nhật feedback thành công',
        feedback: updatedFeedback,
      };
    } catch (error: unknown) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi cập nhật feedback');
    }
  }

  async deleteFeedback(id: number, userId: number) {
    try {
      const feedback = await this.prisma.feedback.findUnique({
        where: { id },
      });

      if (!feedback) {
        throw new NotFoundException('Feedback không tồn tại');
      }

      // Kiểm tra quyền sở hữu
      if (feedback.userId !== userId) {
        throw new BadRequestException('Bạn không có quyền xóa feedback này');
      }

      await this.prisma.feedback.delete({
        where: { id },
      });

      return {
        message: 'Xóa feedback thành công',
      };
    } catch (error: unknown) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi xóa feedback');
    }
  }

  async getMyFeedbacks(userId: number) {
    try {
      const feedbacks = await this.prisma.feedback.findMany({
        where: { userId },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              description: true,
              startTime: true,
              endTime: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return feedbacks;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi lấy danh sách feedback của bạn');
    }
  }
}
