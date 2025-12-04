import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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
  getSeatsByVenueId(@Param('venueId') venueId: string) {
    return this.seatService.getSeatsByVenueId(parseInt(venueId));
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
  @ApiOperation({ summary: 'Cập nhật loại ghế (organizer only)' })
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
