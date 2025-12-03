import { CreateCampusDto } from './dto/createCampus.dto';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CampusService } from './campus.service';
import { Public } from '../auth/decorator';

@ApiTags('campus')
@Controller('campus')
export class CampusController {
  constructor(private readonly campusService: CampusService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách campus' })
  findAll() {
    return this.campusService.findAll();
  }

  @Post()
  @Public()
  @ApiOperation({ summary: 'Tạo thêm campus' })
  createCampus(@Body() campus: CreateCampusDto) {
    return this.campusService.createCampus(campus);
  }
}
