import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
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
import { CheckinLogService } from './checkin-log.service';
import {
  CreateCheckinLogDto,
  UpdateCheckinLogDto,
  QueryCheckinLogDto,
} from './dto';
import { JwtGuard, RolesGuard } from '../auth/guard';
import { Roles } from '../auth/decorator';
import { UserRole } from '@prisma/client';

@ApiTags('checkin-logs')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Controller('checkin-logs')
export class CheckinLogController {
  constructor(private readonly checkinLogService: CheckinLogService) {}

  @Post()
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({
    summary: 'Create a new check-in log - Required roles: admin, staff',
  })
  @ApiResponse({
    status: 201,
    description: 'Check-in log created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., validation error, message required for FAIL)',
  })
  @ApiResponse({
    status: 404,
    description: 'Ticket or Staff not found',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, staff',
  })
  async create(@Body() dto: CreateCheckinLogDto) {
    return this.checkinLogService.create(dto);
  }

  @Get()
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({
    summary:
      'Get all check-in logs with pagination and filters - Required roles: admin, staff',
    description: 'Support pagination, result, ticketId, staffId filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of check-in logs with meta retrieved successfully',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, staff',
  })
  async findAll(@Query() query: QueryCheckinLogDto) {
    return this.checkinLogService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({
    summary: 'Get check-in log by ID - Required roles: admin, staff',
  })
  @ApiResponse({
    status: 200,
    description: 'Check-in log retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Check-in log not found',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, staff',
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.checkinLogService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({
    summary: 'Update check-in log by ID - Required roles: admin, staff',
  })
  @ApiResponse({
    status: 200,
    description: 'Check-in log updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Check-in log not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., validation error, message required for FAIL)',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, staff',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCheckinLogDto,
  ) {
    return this.checkinLogService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Delete check-in log by ID - Required roles: admin' })
  @ApiResponse({
    status: 200,
    description: 'Check-in log deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Check-in log not found',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.checkinLogService.remove(id);
  }
}

