import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SeatService } from './seat.service';
import { UpdateSeatTypeDto, ToggleSeatStatusDto } from './dto';
import { Public } from '../auth/decorator';
import { Roles } from '../auth/decorator/roles.decorator';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { UserRole } from '@prisma/client';

@ApiTags('seat')
@Controller('seat')
@UseGuards(JwtGuard, RolesGuard)
export class SeatController {
  constructor(private readonly seatService: SeatService) {}

  @Get('venue/:venueId')
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách ghế theo venue ID' })
  @ApiQuery({
    name: 'eventId',
    required: false,
    description:
      'Event ID để check availability (nếu có sẽ tính isBooked theo event đó)',
  })
  getSeatsByVenueId(
    @Param('venueId') venueId: string,
    @Query('eventId') eventId?: string,
  ) {
    return this.seatService.getSeatsByVenueId(
      parseInt(venueId),
      eventId ? eventId : undefined,
    );
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Lấy thông tin ghế theo ID' })
  getSeatById(@Param('id') id: string) {
    return this.seatService.getSeatById(parseInt(id));
  }

  @Patch(':id/type')
  @Roles(UserRole.event_organizer)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật loại ghế cho event cụ thể (organizer only)',
    description:
      'Set seatType cho ghế trong event cụ thể. Mỗi event có thể có seatType khác nhau cho cùng một ghế.',
  })
  updateSeatType(@Param('id') id: string, @Body() dto: UpdateSeatTypeDto) {
    return this.seatService.updateSeatType(parseInt(id), dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Active/Deactive ghế (admin only)' })
  toggleSeatStatus(@Param('id') id: string, @Body() dto: ToggleSeatStatusDto) {
    return this.seatService.toggleSeatStatus(parseInt(id), dto);
  }
}
