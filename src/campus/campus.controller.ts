import { CreateCampusDto, UpdateCampusStatusDto } from './dto';
import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CampusService } from './campus.service';
import { Public } from '../auth/decorator';
import { Roles } from '../auth/decorator/roles.decorator';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { UserRole } from '@prisma/client';

@ApiTags('campus')
@Controller('campus')
@UseGuards(JwtGuard, RolesGuard)
export class CampusController {
  constructor(private readonly campusService: CampusService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách campus' })
  @ApiQuery({
    name: 'status',
    enum: ['Active', 'Inactive'],
    required: false,
    description: 'Lấy campus theo status (Active, Inactive)',
  })
  findAll(@Query('status') status?: string) {
    return this.campusService.findAll(status);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Lấy thông tin campus theo ID' })
  getCampusById(@Param('id') id: string) {
    return this.campusService.getCampusById(parseInt(id));
  }

  @Get(':id/venues')
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách venues của campus' })
  getVenuesByCampusId(@Param('id') id: string) {
    return this.campusService.getVenuesByCampusId(parseInt(id));
  }

  @Post()
  @Roles(UserRole.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo thêm campus (admin only)' })
  createCampus(@Body() campus: CreateCampusDto) {
    return this.campusService.createCampus(campus);
  }

  @Patch(':id')
  @Roles(UserRole.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật thông tin campus (admin only)' })
  updateCampus(@Param('id') id: string, @Body() campus: CreateCampusDto) {
    return this.campusService.updateCampus(parseInt(id), campus);
  }

  @Patch(':id/status')
  @Roles(UserRole.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật trạng thái campus (Active/Inactive) (admin only)',
    description:
      'Dùng API này để activate (Active) hoặc deactivate (Inactive) campus. Thay thế cho API DELETE và PATCH /activate cũ.',
  })
  updateCampusStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCampusStatusDto,
  ) {
    return this.campusService.updateCampusStatus(parseInt(id), dto.status);
  }
}
