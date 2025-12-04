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
import {
  CreateEventDto,
  UpdateEventDto,
  QueryEventDto,
  AssignStaffDto,
} from './dto';
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

  @Get('assigned')
  @Roles(UserRole.staff)
  @ApiOperation({
    summary: 'Get events assigned to current staff - Required roles: staff',
    description:
      'Returns only events that the current staff member is assigned to (via EventStaff table). Support pagination, search, status, organizerId, venueId filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of assigned events with meta retrieved successfully',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: staff',
  })
  async findAssignedEvents(
    @GetUser('id') staffId: number,
    @Query() query: QueryEventDto,
  ) {
    return this.eventService.findAssignedEvents(staffId, query);
  }

  @Get('my-events')
  @Roles(UserRole.event_organizer)
  @ApiOperation({
    summary:
      'Get events of current organizer - Required roles: event_organizer',
    description:
      'Returns only events that belong to organizers owned by the current user. Support pagination, search, status, venueId filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of organizer events with meta retrieved successfully',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: event_organizer',
  })
  async findMyEvents(
    @GetUser('id') organizerUserId: number,
    @Query() query: QueryEventDto,
  ) {
    return this.eventService.findMyEvents(organizerUserId, query);
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

  @Post(':eventId/staff')
  @Roles(UserRole.admin, UserRole.event_organizer)
  @ApiOperation({
    summary: 'Assign staff to event - Required roles: admin, event_organizer',
    description:
      'Assigns a staff member to an event for check-in duties. Only the event organizer owner or admin can assign staff.',
  })
  @ApiResponse({
    status: 201,
    description: 'Staff assigned to event successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request (e.g., staff already assigned, user is not a staff member)',
  })
  @ApiResponse({
    status: 404,
    description: 'Event or Staff not found',
  })
  @ApiForbiddenResponse({
    description:
      'Forbidden. Required roles: admin, event_organizer. Or you do not own this event organizer.',
  })
  async assignStaff(
    @Param('eventId') eventId: string,
    @Body() dto: AssignStaffDto,
    @GetUser() user: any,
  ) {
    return this.eventService.assignStaff(eventId, dto, {
      userId: user.id,
      roleName: user.roleName,
    });
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
