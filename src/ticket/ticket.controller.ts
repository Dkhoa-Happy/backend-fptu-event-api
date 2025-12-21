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
import { TicketService } from './ticket.service';
import {
  CreateTicketDto,
  UpdateTicketDto,
  QueryTicketDto,
  QueryMyTicketDto,
  ScanTicketDto,
  ManualCheckinDto,
  QueryEventAttendeesDto,
} from './dto';
import { JwtGuard, RolesGuard } from '../auth/guard';
import { GetUser, Roles } from '../auth/decorator';
import { UserRole } from '@prisma/client';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  @Roles(UserRole.student)
  @ApiOperation({
    summary:
      'Create a new ticket (register for event) - Required roles: student',
  })
  @ApiResponse({
    status: 201,
    description: 'Ticket created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., user already registered)',
  })
  @ApiResponse({
    status: 404,
    description: 'User or Event not found',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: student',
  })
  async create(@Body() dto: CreateTicketDto, @GetUser('id') userId: number) {
    return this.ticketService.create(dto, userId);
  }

  @Get()
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({
    summary:
      'Get all tickets with pagination and filters - Required roles: admin, staff',
    description: 'Support pagination, status, userId, eventId filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of tickets with meta retrieved successfully',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, staff',
  })
  async findAll(@Query() query: QueryTicketDto) {
    return this.ticketService.findAll(query);
  }

  @Get('me')
  @Roles(UserRole.student)
  @ApiOperation({
    summary:
      'Get current student tickets with pagination - Required roles: student',
  })
  @ApiResponse({
    status: 200,
    description: 'List of current user tickets with meta retrieved',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: student',
  })
  async findMyTickets(
    @GetUser('id') userId: number,
    @Query() query: QueryMyTicketDto,
  ) {
    return this.ticketService.findMyTickets(userId, query);
  }

  @Get('events/:eventId/attendees')
  @Roles(UserRole.admin, UserRole.staff, UserRole.event_organizer)
  @ApiOperation({
    summary:
      'Get attendees of an event with summary - Required roles: admin, staff, event_organizer',
    description:
      'Returns attendee list (tickets) and summary (total, checked-in, not check-in, cancelled, attendance rate). Staff must be assigned to the event; organizer must own the organizer.',
  })
  @ApiResponse({
    status: 200,
    description: 'Attendees retrieved successfully',
  })
  @ApiForbiddenResponse({
    description:
      'Forbidden. Staff must be assigned; organizer must own this organizer; admin can view any.',
  })
  async getEventAttendees(
    @Param('eventId') eventId: string,
    @Query() query: QueryEventAttendeesDto,
    @GetUser() user: any,
  ) {
    return this.ticketService.getEventAttendees(eventId, query, user);
  }

  @Get('qr/:qrCode')
  @Roles(UserRole.admin, UserRole.staff, UserRole.student)
  @ApiOperation({
    summary: 'Get ticket by QR code - Required roles: admin, staff, student',
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Ticket not found',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, staff, student',
  })
  async findByQrCode(@Param('qrCode') qrCode: string) {
    return this.ticketService.findByQrCode(qrCode);
  }

  @Post('scan')
  @Roles(UserRole.staff)
  @ApiOperation({
    summary: 'Scan ticket QR code for check-in - Required roles: staff',
    description:
      'Scans a ticket QR code and performs check-in. Updates ticket status to USED if valid, creates check-in log. Uses transaction to ensure data consistency.',
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket scanned successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        ticket: { type: 'object', nullable: true },
        user: { type: 'object', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Ticket or Staff not found',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, staff',
  })
  async scanTicket(@Body() dto: ScanTicketDto) {
    return this.ticketService.scanTicket(dto.qrCode, dto.staffId);
  }

  @Post('manual-checkin')
  @Roles(UserRole.staff)
  @ApiOperation({
    summary: 'Manual check-in ticket - Required roles: staff',
    description:
      'Perform manual check-in when QR code scanning is not possible. Can use ticketId or (userId + eventId) to find the ticket. Updates ticket status to USED if valid. Uses transaction to ensure data consistency.',
  })
  @ApiResponse({
    status: 200,
    description: 'Manual check-in successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        ticket: { type: 'object', nullable: true },
        user: { type: 'object', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request (e.g., missing required fields, ticket already used/cancelled/expired)',
  })
  @ApiResponse({
    status: 404,
    description: 'Ticket or Staff not found',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: staff',
  })
  async manualCheckin(@Body() dto: ManualCheckinDto) {
    return this.ticketService.manualCheckin(dto);
  }

  @Get(':id')
  @Roles(UserRole.admin, UserRole.staff, UserRole.student)
  @ApiOperation({
    summary: 'Get ticket by ID - Required roles: admin, staff, student',
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Ticket not found',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, staff, student',
  })
  async findOne(@Param('id') id: string) {
    return this.ticketService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({
    summary: 'Update ticket by ID - Required roles: admin, staff',
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Ticket not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., validation error)',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, staff',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketService.update(id, dto);
  }

  @Post(':id/cancel')
  @Roles(UserRole.student)
  @ApiOperation({
    summary: 'Cancel ticket - Required roles: student',
    description:
      'Cancel a ticket. Only allowed if the event starts more than 1 day from now. The seat will be freed and event registeredCount will be decremented.',
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket cancelled successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Ticket not found',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request (e.g., cannot cancel, ticket already cancelled/used)',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: student',
  })
  async cancel(@Param('id') id: string, @GetUser('id') userId: number) {
    return this.ticketService.cancel(id, userId);
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Delete ticket by ID - Required roles: admin' })
  @ApiResponse({
    status: 200,
    description: 'Ticket deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Ticket not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete ticket (referenced by other records)',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin',
  })
  async remove(@Param('id') id: string) {
    return this.ticketService.remove(id);
  }
}
