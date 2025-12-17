import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { OrganizerService } from './organizer.service';
import { CreateOrganizerDto, UpdateOrganizerDto } from './dto';
import { JwtGuard, RolesGuard } from '../auth/guard';
import { Roles } from '../auth/decorator';
import { UserRole } from '@prisma/client';
import { GetUser } from '../auth/decorator';

@ApiTags('organizers')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Controller('organizers')
export class OrganizerController {
  constructor(private readonly organizerService: OrganizerService) {}

  @Post()
  @Roles(UserRole.admin, UserRole.event_organizer)
  @ApiOperation({
    summary:
      'Create a new organizer - Required roles: admin, event_organizer',
  })
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
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, event_organizer',
  })
  async create(@Body() dto: CreateOrganizerDto) {
    return this.organizerService.create(dto);
  }

  @Get()
  @Roles(UserRole.admin, UserRole.staff, UserRole.event_organizer)
  @ApiOperation({
    summary:
      'Get all organizers - Required roles: admin, staff, event_organizer',
  })
  @ApiResponse({
    status: 200,
    description: 'List of organizers retrieved successfully',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, staff, event_organizer',
  })
  async findAll(@GetUser('id') userId: number, @GetUser('roleName') role: UserRole) {
    return this.organizerService.findAllForRole(userId, role);
  }

  @Get(':id')
  @Roles(UserRole.admin, UserRole.staff, UserRole.event_organizer)
  @ApiOperation({
    summary: 'Get organizer by ID - Required roles: admin, staff, event_organizer',
  })
  @ApiResponse({
    status: 200,
    description: 'Organizer retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Organizer not found',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, staff, event_organizer',
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetUser('id') userId: number,
    @GetUser('roleName') role: UserRole,
  ) {
    return this.organizerService.findOneForRole(id, userId, role);
  }

  @Put(':id')
  @Roles(UserRole.admin, UserRole.event_organizer)
  @ApiOperation({
    summary: 'Update organizer by ID - Required roles: admin, event_organizer',
  })
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
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, event_organizer',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrganizerDto,
  ) {
    return this.organizerService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Delete organizer by ID - Required roles: admin' })
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
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.organizerService.remove(id);
  }
}

