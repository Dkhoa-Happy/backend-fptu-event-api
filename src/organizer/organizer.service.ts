import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizerDto, UpdateOrganizerDto } from './dto';

@Injectable()
export class OrganizerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrganizerDto) {
    // Validate that owner_id exists
    const owner = await this.prisma.user.findUnique({
      where: { id: dto.ownerId },
    });

    if (!owner) {
      throw new NotFoundException(`User with ID ${dto.ownerId} not found`);
    }

    // Validate that campus_id exists
    const campus = await this.prisma.campus.findUnique({
      where: { id: dto.campusId },
    });

    if (!campus) {
      throw new NotFoundException(`Campus with ID ${dto.campusId} not found`);
    }

    try {
      const organizer = await this.prisma.organizer.create({
        data: {
          name: dto.name,
          description: dto.description,
          contactEmail: dto.contactEmail,
          logoUrl: dto.logoUrl,
          ownerId: dto.ownerId,
          campusId: dto.campusId,
        },
        include: {
          owner: {
            select: {
              id: true,
              userName: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          campus: {
            select: {
              id: true,
              name: true,
              code: true,
              address: true,
            },
          },
        },
      });

      return organizer;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException('Organizer with this name already exists');
      }
      throw error;
    }
  }

  async findAll() {
    const organizers = await this.prisma.organizer.findMany({
      include: {
        owner: {
          select: {
            id: true,
            userName: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        campus: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return organizers;
  }

  async findOne(id: number) {
    const organizer = await this.prisma.organizer.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            userName: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        campus: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
          },
        },
      },
    });

    if (!organizer) {
      throw new NotFoundException(`Organizer with ID ${id} not found`);
    }

    return organizer;
  }

  async update(id: number, dto: UpdateOrganizerDto) {
    // Check if organizer exists
    const existingOrganizer = await this.prisma.organizer.findUnique({
      where: { id },
    });

    if (!existingOrganizer) {
      throw new NotFoundException(`Organizer with ID ${id} not found`);
    }

    // Validate owner_id if provided
    if (dto.ownerId !== undefined) {
      const owner = await this.prisma.user.findUnique({
        where: { id: dto.ownerId },
      });

      if (!owner) {
        throw new NotFoundException(`User with ID ${dto.ownerId} not found`);
      }
    }

    // Validate campus_id if provided
    if (dto.campusId !== undefined) {
      const campus = await this.prisma.campus.findUnique({
        where: { id: dto.campusId },
      });

      if (!campus) {
        throw new NotFoundException(`Campus with ID ${dto.campusId} not found`);
      }
    }

    try {
      const organizer = await this.prisma.organizer.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          contactEmail: dto.contactEmail,
          logoUrl: dto.logoUrl,
          ownerId: dto.ownerId,
          campusId: dto.campusId,
        },
        include: {
          owner: {
            select: {
              id: true,
              userName: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          campus: {
            select: {
              id: true,
              name: true,
              code: true,
              address: true,
            },
          },
        },
      });

      return organizer;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`Organizer with ID ${id} not found`);
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException('Organizer with this name already exists');
      }

      throw error;
    }
  }

  async remove(id: number) {
    // Check if organizer exists
    const organizer = await this.prisma.organizer.findUnique({
      where: { id },
    });

    if (!organizer) {
      throw new NotFoundException(`Organizer with ID ${id} not found`);
    }

    try {
      await this.prisma.organizer.delete({
        where: { id },
      });

      return { message: `Organizer with ID ${id} has been deleted successfully` };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`Organizer with ID ${id} not found`);
      }

      // Handle foreign key constraint errors
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2003'
      ) {
        throw new BadRequestException(
          'Cannot delete organizer because it is referenced by other records (e.g., events)',
        );
      }

      throw error;
    }
  }
}

