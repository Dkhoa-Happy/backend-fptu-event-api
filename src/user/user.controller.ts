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
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { GetUser, Roles } from '../auth/decorator';
import { JwtGuard, RolesGuard } from '../auth/guard';
import { UserRole } from '@prisma/client';
import {
  ApproveUserDto,
  CreateUserDto,
  QueryUserDto,
  QueryStaffDto,
  UpdateProfileDto,
  UpdateUserDto,
} from './dto';

@ApiTags('user')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
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
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Create a new user (for admin management) - Required roles: admin',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin',
  })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async createUser(@Body() dto: CreateUserDto) {
    return this.userService.createUser(dto);
  }

  @Get()
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({
    summary:
      'Get all users with pagination and filters - Required roles: admin, staff',
    description:
      'Support pagination, search, roleName, isActive, campusId for management',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, staff',
  })
  @ApiResponse({ status: 200, description: 'List of users with meta' })
  async getUsers(@Query() query: QueryUserDto) {
    return this.userService.getUsers(query);
  }

  @Get('staff')
  @Roles(UserRole.event_organizer)
  @ApiOperation({
    summary:
      'Get all staff users with pagination and filters - Required roles: event_organizer',
    description:
      'Returns only staff users. Role filter is not available as this endpoint only returns staff.',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: event_organizer',
  })
  @ApiResponse({ status: 200, description: 'List of staff users with meta' })
  async getStaffs(@Query() query: QueryStaffDto) {
    return this.userService.getStaffs(query);
  }

  @Get('pending')
  @Roles(UserRole.admin)
  @ApiOperation({
    summary:
      'Get all pending users waiting for approval - Required roles: admin',
    description:
      'Returns list of users with PENDING status who submitted student card images',
  })
  @ApiResponse({
    status: 200,
    description: 'List of pending users with student card images',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin',
  })
  async getPendingUsers(@Query() query: QueryUserDto) {
    return this.userService.getPendingUsers(query);
  }

  @Get(':id')
  @Roles(UserRole.admin, UserRole.staff, UserRole.event_organizer)
  @ApiOperation({
    summary:
      'Get user detail by id - Required roles: admin, staff, event_organizer',
  })
  @ApiResponse({ status: 200, description: 'User detail' })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, staff',
  })
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getById(id);
  }

  @Patch(':id')
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Update user information - Required roles: admin',
  })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin',
  })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.updateUser(id, dto);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Deactivate user (soft delete) - Required roles: admin',
  })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin',
  })
  async deactivateUser(@Param('id', ParseIntPipe) id: number) {
    return this.userService.deactivateUser(id);
  }

  @Patch(':id/activate')
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Activate user (reactivate) - Required roles: admin',
  })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin',
  })
  async activateUser(@Param('id', ParseIntPipe) id: number) {
    return this.userService.activateUser(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Update user status (Approve or Reject) - Required roles: admin',
    description:
      'Approve (APPROVED) or reject (REJECTED) a user account that is pending approval. Only PENDING users can have their status changed.',
  })
  @ApiResponse({
    status: 200,
    description: 'User status updated successfully',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin',
  })
  async updateUserStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveUserDto,
  ) {
    return this.userService.approveUser(id, dto);
  }
}
