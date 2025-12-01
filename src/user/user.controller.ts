import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { GetUser } from '../auth/decorator';
import { JwtGuard } from '../auth/guard';

@ApiTags('user')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  async getMe(@GetUser('id') userId: number) {
    return this.userService.getMe(userId);
  }
}
