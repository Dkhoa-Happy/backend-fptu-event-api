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
} from '@nestjs/swagger';
import { CheckinLogService } from './checkin-log.service';
import {
  CreateCheckinLogDto,
  UpdateCheckinLogDto,
  QueryCheckinLogDto,
} from './dto';
import { JwtGuard } from '../auth/guard';

@ApiTags('checkin-logs')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('checkin-logs')
export class CheckinLogController {
  constructor(private readonly checkinLogService: CheckinLogService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new check-in log' })
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
  async create(@Body() dto: CreateCheckinLogDto) {
    return this.checkinLogService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all check-in logs with pagination and filters',
    description: 'Support pagination, result, ticketId, staffId filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of check-in logs with meta retrieved successfully',
  })
  async findAll(@Query() query: QueryCheckinLogDto) {
    return this.checkinLogService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get check-in log by ID' })
  @ApiResponse({
    status: 200,
    description: 'Check-in log retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Check-in log not found',
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.checkinLogService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update check-in log by ID' })
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
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCheckinLogDto,
  ) {
    return this.checkinLogService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete check-in log by ID' })
  @ApiResponse({
    status: 200,
    description: 'Check-in log deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Check-in log not found',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.checkinLogService.remove(id);
  }
}

