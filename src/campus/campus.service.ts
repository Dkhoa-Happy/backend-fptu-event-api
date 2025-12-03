import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampusDto } from './dto';

@Injectable()
export class CampusService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.campus.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        capacity: true,
        address: true,
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
}
