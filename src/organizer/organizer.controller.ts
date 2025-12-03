import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrganizerService } from './organizer.service';
import { CreateOrganizerDto, UpdateOrganizerDto } from './dto';
import { UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/guard';

@ApiTags('organizers')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('organizers')
export class OrganizerController {
  constructor(private readonly organizerService: OrganizerService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organizer' })
  @ApiResponse({
    status: 201,
    description: 'Organizer created successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Owner or Campus not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., validation error)',
  })
  async create(@Body() dto: CreateOrganizerDto) {
    return this.organizerService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all organizers' })
  @ApiResponse({
    status: 200,
    description: 'List of organizers retrieved successfully',
  })
  async findAll() {
    return this.organizerService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organizer by ID' })
  @ApiResponse({
    status: 200,
    description: 'Organizer retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Organizer not found',
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.organizerService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update organizer by ID' })
  @ApiResponse({
    status: 200,
    description: 'Organizer updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Organizer, Owner, or Campus not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., validation error)',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrganizerDto,
  ) {
    return this.organizerService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete organizer by ID' })
  @ApiResponse({
    status: 200,
    description: 'Organizer deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Organizer not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete organizer (referenced by other records)',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.organizerService.remove(id);
  }
}

