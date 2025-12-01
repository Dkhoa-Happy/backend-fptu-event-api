import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register({ email, password, fullName }: RegisterDto) {
    try {
      const user = await this.prisma.user.create({
        data: { email, password, fullName },
      });

      return {
        message: 'Register successfully',
        user,
      };
    } catch (error: unknown) {
      // Prisma unique constraint violation
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  async login({ email, password }: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.password !== password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      message: 'Login successfully',
      user,
      accessToken: this.createFakeToken(user.id),
    };
  }

  // chỉ để test nhanh API /auth/ping
  ping() {
    return {
      message: 'Auth service ready with Prisma',
    };
  }

  private createFakeToken(userId: number) {
    return Buffer.from(`${userId}:${Date.now()}`).toString('base64');
  }
}
