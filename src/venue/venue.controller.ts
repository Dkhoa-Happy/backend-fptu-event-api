import { CreateVenueDto } from './dto/createVenue.dto';
import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { VenueService } from './venue.service';
import { Public } from '../auth/decorator';
import { Roles } from '../auth/decorator/roles.decorator';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { UserRole } from '@prisma/client';

@ApiTags('venue')
@Controller('venue')
@UseGuards(JwtGuard, RolesGuard)
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách venue' })
  @ApiQuery({
    name: 'status',
    enum: ['Active', 'Inactive'],
    required: false,
    description: 'Lấy venue theo status (Active, Inactive)',
  })
  findAll(@Query('status') status?: string) {
    return this.venueService.findAll(status);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Lấy thông tin venue theo ID' })
  getVenueById(@Param('id') id: string) {
    return this.venueService.getVenueById(parseInt(id));
  }

  @Post()
  @Roles(UserRole.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo thêm venue (admin only)' })
  createVenue(@Body() venue: CreateVenueDto) {
    return this.venueService.createVenue(venue);
  }

  @Patch(':id')
  @Roles(UserRole.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật thông tin venue (admin only)' })
  updateVenue(@Param('id') id: string, @Body() venue: CreateVenueDto) {
    return this.venueService.updateVenue(parseInt(id), venue);
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xóa venue (set status thành Inactive) (admin only)',
  })
  deleteVenueById(@Param('id') id: string) {
    return this.venueService.deleteVenueById(parseInt(id));
  }
}
