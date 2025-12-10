import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IncidentService } from './incident.service';
import {
  CreateIncidentDto,
  UpdateIncidentStatusDto,
  FilterIncidentsDto,
  UpdateIncidentDto,
} from './dto';
import { JwtGuard, RolesGuard } from '../auth/guard';
import { GetUser, Roles } from '../auth/decorator';
import { UserRole } from '@prisma/client';

@ApiTags('incidents')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Controller('incidents')
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Post()
  @Roles(UserRole.staff)
  @ApiOperation({
    summary:
      'Staff báo cáo sự cố trước khi sự kiện diễn ra - Required role: staff',
  })
  createIncident(
    @Body() dto: CreateIncidentDto,
    @GetUser('id') userId: number,
  ) {
    return this.incidentService.createIncident(dto, userId);
  }

  @Get('my')
  @Roles(UserRole.staff)
  @ApiOperation({
    summary: 'Xem danh sách sự cố do tôi báo cáo - Required role: staff',
  })
  getMyIncidents(@GetUser('id') userId: number) {
    return this.incidentService.getMyIncidents(userId);
  }

  @Get()
  @Roles(UserRole.event_organizer, UserRole.admin)
  @ApiOperation({
    summary:
      'Xem tất cả sự cố với bộ lọc - Admin xem tất cả, Event Organizer chỉ xem sự cố của sự kiện mình sở hữu',
  })
  getAllIncidents(
    @Query() filters: FilterIncidentsDto,
    @GetUser() user: any,
  ) {
    return this.incidentService.getAllIncidents(filters, user);
  }

  @Get('event/:eventId')
  @Roles(UserRole.staff, UserRole.event_organizer, UserRole.admin)
  @ApiOperation({
    summary:
      'Xem sự cố của một sự kiện - Staff phải được phân công, Organizer owner hoặc Admin',
  })
  getEventIncidents(@Param('eventId') eventId: string, @GetUser() user: any) {
    return this.incidentService.getEventIncidents(eventId, user);
  }

  @Patch(':id/status')
  @Roles(UserRole.event_organizer, UserRole.admin)
  @ApiOperation({
    summary:
      'Cập nhật trạng thái sự cố - Admin, Organizer owner hoặc chính Staff reporter',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
    @GetUser() user: any,
  ) {
    return this.incidentService.updateIncidentStatus(
      parseInt(id, 10),
      dto,
      user,
    );
  }

  @Patch(':id')
  @Roles(UserRole.event_organizer, UserRole.admin)
  @ApiOperation({
    summary:
      'Chỉnh sửa thông tin sự cố (title, description, severity, status) - Chỉ Admin và Event Organizer (chủ sở hữu sự kiện)',
  })
  updateIncident(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
    @GetUser() user: any,
  ) {
    return this.incidentService.updateIncident(parseInt(id, 10), dto, user);
  }
}
