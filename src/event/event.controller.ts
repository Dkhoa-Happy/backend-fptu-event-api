import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { EventService } from './event.service';
import { CreateEventDto, UpdateEventDto, QueryEventDto } from './dto';
import { JwtGuard } from '../auth/guard';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({
    status: 201,
    description: 'Event created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., validation error)',
  })
  async create(@Body() dto: CreateEventDto) {
    return this.eventService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all events with pagination and filters',
    description:
      'Support pagination, search, status, organizerId, venueId filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of events with meta retrieved successfully',
  })
  async findAll(@Query() query: QueryEventDto) {
    return this.eventService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiResponse({
    status: 200,
    description: 'Event retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Event not found',
  })
  async findOne(@Param('id') id: string) {
    return this.eventService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update event by ID' })
  @ApiResponse({
    status: 200,
    description: 'Event updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Event not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., validation error)',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete event by ID' })
  @ApiResponse({
    status: 200,
    description: 'Event deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Event not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete event (referenced by other records)',
  })
  async remove(@Param('id') id: string) {
    return this.eventService.remove(id);
  }
}

