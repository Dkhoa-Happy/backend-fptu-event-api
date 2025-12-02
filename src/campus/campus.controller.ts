import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CampusService } from './campus.service';
import { Public } from '../auth/decorator';

@ApiTags('campus')
@Controller('campus')
export class CampusController {
  constructor(private readonly campusService: CampusService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get list of campuses (public)' })
  async findAll() {
    return this.campusService.findAll();
  }
}


