import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EventStatus,
  IncidentStatus,
  IncidentSeverity,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto, UpdateIncidentStatusDto } from './dto';

@Injectable()
export class IncidentService {
  constructor(private readonly prisma: PrismaService) {}

  async createIncident(dto: CreateIncidentDto, reporterId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
      select: {
        id: true,
        title: true,
        startTime: true,
        status: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    // Chỉ cho phép báo cáo trước khi sự kiện diễn ra
    const now = new Date();
    if (now >= new Date(event.startTime)) {
      throw new BadRequestException(
        'Chỉ có thể báo cáo sự cố trước khi sự kiện diễn ra',
      );
    }

    if (event.status === EventStatus.CANCELED) {
      throw new BadRequestException('Sự kiện đã bị hủy');
    }

    // Staff phải được phân công cho sự kiện
    const assignment = await this.prisma.eventStaff.findUnique({
      where: {
        eventId_userId: {
          eventId: dto.eventId,
          userId: reporterId,
        },
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'Bạn không được phân công cho sự kiện này nên không thể báo cáo sự cố',
      );
    }

    const incident = await this.prisma.incident.create({
      data: {
        title: dto.title,
        description: dto.description,
        severity: dto.severity ?? IncidentSeverity.MEDIUM,
        reporterId,
        eventId: dto.eventId,
      },
      include: this.defaultInclude(),
    });

    return {
      message: 'Đã tạo báo cáo sự cố',
      incident,
    };
  }

  async getMyIncidents(reporterId: number) {
    const incidents = await this.prisma.incident.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
      include: this.defaultInclude(),
    });

    return incidents;
  }

  async getEventIncidents(
    eventId: string,
    user: { id?: number; roleName?: string },
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        organizer: { select: { ownerId: true } },
      },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    const isAdmin = user.roleName === 'admin';
    const isOrganizerOwner =
      user.roleName === 'event_organizer' &&
      !!event.organizer?.ownerId &&
      event.organizer.ownerId === user.id;

    const isAssignedStaff =
      user.roleName === 'staff' &&
      !!(await this.prisma.eventStaff.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId: user.id ?? 0,
          },
        },
      }));

    if (!isAdmin && !isOrganizerOwner && !isAssignedStaff) {
      throw new ForbiddenException('Bạn không có quyền xem sự cố của sự kiện này');
    }

    return this.prisma.incident.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      include: this.defaultInclude(),
    });
  }

  async updateIncidentStatus(
    id: number,
    dto: UpdateIncidentStatusDto,
    user: { id?: number; roleName?: string },
  ) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            organizer: { select: { ownerId: true } },
          },
        },
        reporter: true,
      },
    });

    if (!incident) {
      throw new NotFoundException('Sự cố không tồn tại');
    }

    const isAdmin = user.roleName === 'admin';
    const isOrganizerOwner =
      user.roleName === 'event_organizer' &&
      !!incident.event.organizer?.ownerId &&
      incident.event.organizer.ownerId === user.id;
    const isReporterStaff =
      user.roleName === 'staff' && incident.reporterId === user.id;

    if (!isAdmin && !isOrganizerOwner && !isReporterStaff) {
      throw new ForbiddenException(
        'Bạn không có quyền cập nhật trạng thái sự cố này',
      );
    }

    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        status: dto.status,
      },
      include: this.defaultInclude(),
    });

    return {
      message: 'Đã cập nhật trạng thái sự cố',
      incident: updated,
    };
  }

  private defaultInclude(): Prisma.IncidentInclude {
    return {
      reporter: {
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
          startTime: true,
          endTime: true,
        },
      },
    };
  }
}

