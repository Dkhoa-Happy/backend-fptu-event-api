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
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({
    summary: 'Scan ticket QR code for check-in - Required roles: admin, staff',
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
