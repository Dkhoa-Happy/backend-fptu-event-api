import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { GetUser } from '../auth/decorator';
import { JwtGuard } from '../auth/guard';
import {
  CreateUserDto,
  QueryUserDto,
  UpdateProfileDto,
  UpdateUserDto,
} from './dto';

@ApiTags('user')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('users')
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

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile updated successfully',
  })
  async updateMe(@GetUser('id') userId: number, @Body() dto: UpdateProfileDto) {
    return this.userService.updateMe(userId, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user (for admin management)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async createUser(@Body() dto: CreateUserDto) {
    return this.userService.createUser(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all users with pagination and filters',
    description:
      'Support pagination, search, roleName, isActive, campusId for management',
  })
  @ApiResponse({ status: 200, description: 'List of users with meta' })
  async getUsers(@Query() query: QueryUserDto) {
    return this.userService.getUsers(query);
  }

  @Get('staff')
  @ApiOperation({
    summary: 'Get all staff users with pagination and filters',
  })
  @ApiResponse({ status: 200, description: 'List of staff users with meta' })
  async getStaffs(@Query() query: QueryUserDto) {
    return this.userService.getStaffs(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user detail by id' })
  @ApiResponse({ status: 200, description: 'User detail' })
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user information' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.updateUser(id, dto);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate user (soft delete)' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  async deactivateUser(@Param('id', ParseIntPipe) id: number) {
    return this.userService.deactivateUser(id);
  }
}
