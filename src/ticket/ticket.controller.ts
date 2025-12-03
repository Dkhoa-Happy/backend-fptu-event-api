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
import { TicketService } from './ticket.service';
import {
  CreateTicketDto,
  UpdateTicketDto,
  QueryTicketDto,
  ScanTicketDto,
} from './dto';
import { JwtGuard } from '../auth/guard';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new ticket (register for event)' })
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
  async create(@Body() dto: CreateTicketDto) {
    return this.ticketService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all tickets with pagination and filters',
    description: 'Support pagination, status, userId, eventId filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of tickets with meta retrieved successfully',
  })
  async findAll(@Query() query: QueryTicketDto) {
    return this.ticketService.findAll(query);
  }

  @Get('qr/:qrCode')
  @ApiOperation({ summary: 'Get ticket by QR code' })
  @ApiResponse({
    status: 200,
    description: 'Ticket retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Ticket not found',
  })
  async findByQrCode(@Param('qrCode') qrCode: string) {
    return this.ticketService.findByQrCode(qrCode);
  }

  @Post('scan')
  @ApiOperation({
    summary: 'Scan ticket QR code for check-in',
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
  async scanTicket(@Body() dto: ScanTicketDto) {
    return this.ticketService.scanTicket(dto.qrCode, dto.staffId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket by ID' })
  @ApiResponse({
    status: 200,
    description: 'Ticket retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Ticket not found',
  })
  async findOne(@Param('id') id: string) {
    return this.ticketService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update ticket by ID' })
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
  async update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete ticket by ID' })
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
  async remove(@Param('id') id: string) {
    return this.ticketService.remove(id);
  }
}

