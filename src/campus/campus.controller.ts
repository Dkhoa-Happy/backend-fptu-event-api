import { CreateCampusDto } from './dto/createCampus.dto';
import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { CampusService } from './campus.service';
import { Public } from '../auth/decorator';

@ApiTags('campus')
@Controller('campus')
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

  @Post()
  @Public()
  @ApiOperation({ summary: 'Tạo thêm campus' })
  createCampus(@Body() campus: CreateCampusDto) {
    return this.campusService.createCampus(campus);
  }

  @Patch(':id')
  @Public()
  @ApiOperation({ summary: 'Cập nhật thông tin campus' })
  updateCampus(@Param('id') id: string, @Body() campus: CreateCampusDto) {
    return this.campusService.updateCampus(parseInt(id), campus);
  }

  @Delete(':id')
  @Public()
  @ApiOperation({ summary: 'Xóa campus (set status thành Inactive)' })
  deleteCampusById(@Param('id') id: string) {
    return this.campusService.deleteCampusById(parseInt(id));
  }
}
