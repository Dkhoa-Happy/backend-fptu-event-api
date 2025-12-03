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
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { EventService } from './event.service';
import { CreateEventDto, UpdateEventDto, QueryEventDto } from './dto';
import { JwtGuard, RolesGuard } from '../auth/guard';
import { GetUser, Roles } from '../auth/decorator';
import { UserRole } from '@prisma/client';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @Roles(UserRole.admin, UserRole.event_organizer)
  @ApiOperation({
    summary: 'Create a new event - Required roles: admin, event_organizer',
  })
  @ApiResponse({
    status: 201,
    description: 'Event created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., validation error)',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, event_organizer',
  })
  async create(@Body() dto: CreateEventDto) {
    return this.eventService.create(dto);
  }

  @Get()
  @Roles(
    UserRole.admin,
    UserRole.staff,
    UserRole.event_organizer,
    UserRole.student,
  )
  @ApiOperation({
    summary:
      'Get all events with pagination and filters - Required roles: admin, staff, event_organizer, student',
    description:
      'Support pagination, search, status, organizerId, venueId filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of events with meta retrieved successfully',
  })
  @ApiForbiddenResponse({
    description:
      'Forbidden. Required roles: admin, staff, event_organizer, student',
  })
  async findAll(@Query() query: QueryEventDto, @GetUser() user: any) {
    return this.eventService.findAll(query, user);
  }

  @Get(':id')
  @Roles(
    UserRole.admin,
    UserRole.staff,
    UserRole.event_organizer,
    UserRole.student,
  )
  @ApiOperation({
    summary:
      'Get event by ID - Required roles: admin, staff, event_organizer, student',
  })
  @ApiResponse({
    status: 200,
    description: 'Event retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Event not found',
  })
  @ApiForbiddenResponse({
    description:
      'Forbidden. Required roles: admin, staff, event_organizer, student',
  })
  async findOne(@Param('id') id: string, @GetUser() user: any) {
    return this.eventService.findOne(id, user);
  }

  @Put(':id')
  @Roles(UserRole.admin, UserRole.event_organizer)
  @ApiOperation({
    summary: 'Update event by ID - Required roles: admin, event_organizer',
  })
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
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, event_organizer',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.admin, UserRole.event_organizer)
  @ApiOperation({
    summary: 'Delete event by ID - Required roles: admin, event_organizer',
  })
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
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, event_organizer',
  })
  async remove(@Param('id') id: string) {
    return this.eventService.remove(id);
  }
}
