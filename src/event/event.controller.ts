import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
  UpdateEventStatusDto,
  QueryEventDto,
  AssignStaffDto,
  QueryEventStatsDto,
  RequestCancellationDto,
  ApproveCancellationDto,
  QueryCancellationRequestsDto,
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
  @Roles(UserRole.event_organizer)
  @ApiOperation({
    summary: 'Create a new event - Required roles: event_organizer',
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
  async create(@Body() dto: CreateEventDto, @GetUser() user: any) {
    return this.eventService.create(dto, user);
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
      'Support pagination, search, status, organizerId, venueId filters. Students can only see PUBLISHED events.',
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

  @Get('stats/monthly')
  @Roles(UserRole.admin, UserRole.staff, UserRole.event_organizer)
  @ApiOperation({
    summary:
      'Thống kê số lượng sự kiện theo tháng - Required roles: admin, staff, event_organizer',
    description:
      'Trả về số lượng sự kiện được tổ chức trong từng tháng của năm (tính theo ngày tổ chức sự kiện - startTime, mặc định là năm hiện tại). Dữ liệu phù hợp để hiển thị chart.',
  })
  @ApiResponse({
    status: 200,
    description: 'Thống kê số lượng sự kiện theo tháng',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, staff, event_organizer',
  })
  async getEventStatsByMonth(@Query() query: QueryEventStatsDto) {
    return this.eventService.getEventStatsByMonth(query);
  }

  @Get('cancellation-requests')
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Get cancellation requests - Required roles: admin',
    description:
      'Admin can get a list of all cancellation requests from organizers. Supports pagination and filtering by status, eventId, and requestedBy.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of cancellation requests retrieved successfully',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin.',
  })
  async getCancellationRequests(@Query() query: QueryCancellationRequestsDto) {
    return this.eventService.getCancellationRequests(query);
  }

  @Patch('cancellation-requests/:requestId/status')
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Approve or reject cancellation request - Required roles: admin',
    description:
      'Admin can approve or reject a cancellation request from organizer. When approved, the event will be cancelled and notifications will be sent.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cancellation request processed successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Cancellation request not found',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request (e.g., request already processed, invalid status)',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin.',
  })
  async approveCancellationRequest(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() dto: ApproveCancellationDto,
    @GetUser() user: any,
  ) {
    return this.eventService.approveCancellationRequest(requestId, dto, {
      userId: user.id,
      roleName: user.roleName,
    });
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

  @Delete(':eventId/staff/:userId')
  @Roles(UserRole.admin, UserRole.event_organizer)
  @ApiOperation({
    summary: 'Remove staff from event - Required roles: admin, event_organizer',
    description:
      'Removes a staff member from an event. Only the event organizer owner or admin can remove staff.',
  })
  @ApiResponse({
    status: 200,
    description: 'Staff removed from event successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Event, Staff, or assignment not found',
  })
  @ApiForbiddenResponse({
    description:
      'Forbidden. Required roles: admin, event_organizer. Or you do not own this event organizer.',
  })
  async removeStaff(
    @Param('eventId') eventId: string,
    @Param('userId', ParseIntPipe) userId: number,
    @GetUser() user: any,
  ) {
    return this.eventService.removeStaff(eventId, userId, {
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

  @Get(':id/summary')
  @Roles(UserRole.event_organizer)
  @ApiOperation({
    summary: 'Get attendance summary after event ends - Roles: event_organizer',
  })
  async getSummary(@Param('id') id: string, @GetUser() user: any) {
    return this.eventService.getSummary(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.event_organizer)
  @ApiOperation({
    summary: 'Update event by ID - Required roles: event_organizer',
    description:
      'Event organizer can update event details but cannot change event status. Admin can also update event details. To change event status, use PATCH /events/:id/status endpoint (admin only).',
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
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @GetUser() user: any,
  ) {
    return this.eventService.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Approve or cancel event - Required roles: admin',
    description:
      'Admin can approve (PUBLISHED) or cancel (CANCELED) a pending event. Only PENDING events can have their status changed.',
  })
  @ApiResponse({
    status: 200,
    description: 'Event status updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Event not found',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request (e.g., event is not in PENDING status, validation error)',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin',
  })
  async updateEventStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEventStatusDto,
  ) {
    return this.eventService.updateEventStatus(id, dto);
  }

  @Post(':id/cancel')
  @Roles(UserRole.event_organizer)
  @ApiOperation({
    summary:
      'Request to cancel published event - Required roles: event_organizer',
    description:
      'Organizer can request to cancel a published event with a reason. The request will be sent to admin for approval. Only organizer owner can request cancellation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cancellation request created successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Event not found',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request (e.g., event is already cancelled/completed, pending request exists)',
  })
  @ApiForbiddenResponse({
    description:
      'Forbidden. Required roles: event_organizer. Or you do not own this event organizer.',
  })
  async cancelEvent(
    @Param('id') id: string,
    @Body() dto: RequestCancellationDto,
    @GetUser() user: any,
  ) {
    return this.eventService.cancelEvent(id, dto, {
      userId: user.id,
      roleName: user.roleName,
    });
  }

  @Post(':id/cancel/admin')
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Cancel event directly (admin only) - Required roles: admin',
    description:
      'Admin can cancel a published event directly without approval. When event is cancelled, all tickets will be marked as CANCELLED.',
  })
  @ApiResponse({
    status: 200,
    description: 'Event cancelled successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Event not found',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request (e.g., event is already cancelled/completed, cannot cancel)',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin.',
  })
  async cancelEventByAdmin(@Param('id') id: string, @GetUser() user: any) {
    return this.eventService.cancelEventByAdmin(id, {
      userId: user.id,
      roleName: user.roleName,
    });
  }
}
