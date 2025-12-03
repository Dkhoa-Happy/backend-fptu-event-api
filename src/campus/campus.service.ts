import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampusDto } from './dto';

@Injectable()
export class CampusService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: string) {
    return this.prisma.campus.findMany({
      where: status ? { status } : undefined,
      select: {
        id: true,
        name: true,
        code: true,
        capacity: true,
        address: true,
        status: true,
        venues: {
          select: {
            id: true,
            name: true,
            location: true,
            capacity: true,
            hasSeats: true,
            mapImageUrl: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });
  }
  async createCampus(campus: CreateCampusDto) {
    const { name, code, capacity, address } = campus;
    try {
      const response = await this.prisma.campus.create({
        data: {
          name,
          code,
          capacity,
          address,
          status: 'Active',
        },
      });
      return { message: 'Tạo campus thành công', campus: response };
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes('code')) {
          throw new BadRequestException('Mã campus này đã tồn tại');
        }
        if (error.message.includes('name')) {
          throw new BadRequestException('Tên campus này đã tồn tại');
        }
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi tạo campus');
    }
  }

  async getCampusById(id: number) {
    try {
      const campus = await this.prisma.campus.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          code: true,
          capacity: true,
          address: true,
          status: true,
          venues: {
            select: {
              id: true,
              name: true,
              location: true,
              capacity: true,
              hasSeats: true,
              mapImageUrl: true,
            },
          },
        },
      });
      if (!campus) {
        throw new BadRequestException('Campus không tồn tại');
      }
      return campus;
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi lấy campus');
    }
  }

  async updateCampus(id: number, campus: CreateCampusDto) {
    const { name, code, capacity, address } = campus;
    try {
      const existingCampus = await this.prisma.campus.findUnique({
        where: { id },
      });
      if (!existingCampus) {
        throw new BadRequestException('Campus không tồn tại');
      }
      const response = await this.prisma.campus.update({
        where: { id },
        data: {
          name,
          code,
          capacity,
          address,
        },
      });
      return { message: 'Cập nhật campus thành công', campus: response };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        if (error.message.includes('code')) {
          throw new BadRequestException('Mã campus này đã tồn tại');
        }
        if (error.message.includes('name')) {
          throw new BadRequestException('Tên campus này đã tồn tại');
        }
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi cập nhật campus');
    }
  }

  async deleteCampusById(id: number) {
    try {
      const existingCampus = await this.prisma.campus.findUnique({
        where: { id },
      });
      if (!existingCampus) {
        throw new BadRequestException('Campus không tồn tại');
      }
      const response = await this.prisma.campus.update({
        where: { id },
        data: {
          status: 'Inactive',
        },
      });
      return { message: 'Xóa campus thành công', campus: response };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Lỗi khi xóa campus');
    }
  }
}
