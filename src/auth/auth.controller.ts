import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from './decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a new user' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login with email & password' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'New access & refresh tokens',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Refresh token successfully',
        },
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        refreshToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Initiate Google OAuth login',
    description:
      '⚠️ Không thể test trực tiếp trên Swagger UI. Vui lòng mở URL này trực tiếp trên trình duyệt: http://localhost:8080/auth/google',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Google OAuth login page',
  })
  async googleAuth() {
    // Guard redirects to Google - không cần code ở đây
  }

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Google OAuth callback',
    description:
      'Endpoint này được Google gọi sau khi user đăng nhập. Không cần gọi trực tiếp.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns JWT token after successful Google login',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Google login successfully' },
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    try {
      const result = await this.authService.validateGoogleUser(req.user);

      // Nếu có FRONTEND_URL trong env, redirect về frontend với token
      const frontendUrl = this.config.get<string>('FRONTEND_URL');
      if (frontendUrl) {
        return res.redirect(
          `${frontendUrl}/auth/callback?token=${result.accessToken}&refreshToken=${result.refreshToken}`,
        );
      }

      // Nếu không có FRONTEND_URL, trả về JSON (cho API testing)
      return res.json(result);
    } catch (error) {
      // Xử lý lỗi: redirect về frontend với error hoặc trả về JSON error
      const frontendUrl = this.config.get<string>('FRONTEND_URL');
      if (frontendUrl) {
        const errorMessage = encodeURIComponent(
          error instanceof Error ? error.message : 'Google login failed',
        );
        return res.redirect(`${frontendUrl}/login?error=${errorMessage}`);
      }

      // Trả về JSON error nếu không có FRONTEND_URL
      return res.status(401).json({
        message: error instanceof Error ? error.message : 'Google login failed',
      });
    }
  }
}
