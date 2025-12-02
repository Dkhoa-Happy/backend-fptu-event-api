import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CampusService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.campus.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }
}


