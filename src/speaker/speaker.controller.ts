import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { SpeakerService } from './speaker.service';
import {
  CreateSpeakerDto,
  UpdateSpeakerDto,
  QuerySpeakerDto,
  AssignSpeakerDto,
} from './dto';
import { JwtGuard, RolesGuard } from '../auth/guard';
import { GetUser, Roles } from '../auth/decorator';
import { UserRole } from '@prisma/client';

@ApiTags('speakers')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Controller('speakers')
export class SpeakerController {
  constructor(private readonly speakerService: SpeakerService) {}

  @Post()
  @Roles(UserRole.admin, UserRole.event_organizer)
  @ApiOperation({
    summary: 'Create a new speaker - Required roles: admin, event_organizer',
  })
  @ApiResponse({
    status: 201,
    description: 'Speaker created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., validation error)',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, event_organizer',
  })
  async create(@Body() dto: CreateSpeakerDto) {
    return this.speakerService.create(dto);
  }

  @Get()
  @Roles(
    UserRole.admin,
    UserRole.staff,
    UserRole.event_organizer,
    UserRole.student,
  )
  @ApiOperation({
    summary:
      'Get all speakers with pagination and filters - Required roles: admin, staff, event_organizer, student',
  })
  @ApiResponse({
    status: 200,
    description: 'List of speakers with meta retrieved successfully',
  })
  @ApiForbiddenResponse({
    description:
      'Forbidden. Required roles: admin, staff, event_organizer, student',
  })
  async findAll(@Query() query: QuerySpeakerDto) {
    return this.speakerService.findAll(query);
  }

  @Get(':id')
  @Roles(
    UserRole.admin,
    UserRole.staff,
    UserRole.event_organizer,
    UserRole.student,
  )
  @ApiOperation({
    summary:
      'Get speaker by ID - Required roles: admin, staff, event_organizer, student',
  })
  @ApiResponse({
    status: 200,
    description: 'Speaker retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Speaker not found',
  })
  @ApiForbiddenResponse({
    description:
      'Forbidden. Required roles: admin, staff, event_organizer, student',
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.speakerService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.admin, UserRole.event_organizer)
  @ApiOperation({
    summary: 'Update speaker by ID - Required roles: admin, event_organizer',
  })
  @ApiResponse({
    status: 200,
    description: 'Speaker updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Speaker not found',
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
    @Body() dto: UpdateSpeakerDto,
  ) {
    return this.speakerService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.admin, UserRole.event_organizer)
  @ApiOperation({
    summary: 'Delete speaker by ID - Required roles: admin, event_organizer',
  })
  @ApiResponse({
    status: 200,
    description: 'Speaker deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Speaker not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete speaker (referenced by events)',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Required roles: admin, event_organizer',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.speakerService.remove(id);
  }

  // EventSpeaker Management Endpoints
  @Post('events/:eventId/assign')
  @Roles(UserRole.admin, UserRole.event_organizer)
  @ApiOperation({
    summary:
      'Assign speaker to event - Required roles: admin, event_organizer',
    description:
      'Assigns a speaker to an event. Only the event organizer owner or admin can assign speakers.',
  })
  @ApiResponse({
    status: 201,
    description: 'Speaker assigned to event successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request (e.g., speaker already assigned, validation error)',
  })
  @ApiResponse({
    status: 404,
    description: 'Event or Speaker not found',
  })
  @ApiForbiddenResponse({
    description:
      'Forbidden. Required roles: admin, event_organizer. Or you do not own this event organizer.',
  })
  async assignSpeaker(
    @Param('eventId') eventId: string,
    @Body() dto: AssignSpeakerDto,
    @GetUser() user: any,
  ) {
    return this.speakerService.assignSpeakerToEvent(
      eventId,
      dto,
      user.roleName === 'admin' ? undefined : user.id,
    );
  }

  @Delete('events/:eventId/speakers/:speakerId')
  @Roles(UserRole.admin, UserRole.event_organizer)
  @ApiOperation({
    summary:
      'Remove speaker from event - Required roles: admin, event_organizer',
    description:
      'Removes a speaker from an event. Only the event organizer owner or admin can remove speakers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Speaker removed from event successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Event, Speaker, or assignment not found',
  })
  @ApiForbiddenResponse({
    description:
      'Forbidden. Required roles: admin, event_organizer. Or you do not own this event organizer.',
  })
  async removeSpeaker(
    @Param('eventId') eventId: string,
    @Param('speakerId', ParseIntPipe) speakerId: number,
    @GetUser() user: any,
  ) {
    return this.speakerService.removeSpeakerFromEvent(
      eventId,
      speakerId,
      user.roleName === 'admin' ? undefined : user.id,
    );
  }

  @Get('events/:eventId')
  @Roles(
    UserRole.admin,
    UserRole.staff,
    UserRole.event_organizer,
    UserRole.student,
  )
  @ApiOperation({
    summary:
      'Get all speakers of an event - Required roles: admin, staff, event_organizer, student',
  })
  @ApiResponse({
    status: 200,
    description: 'List of event speakers retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Event not found',
  })
  @ApiForbiddenResponse({
    description:
      'Forbidden. Required roles: admin, staff, event_organizer, student',
  })
  async getEventSpeakers(@Param('eventId') eventId: string) {
    return this.speakerService.findEventSpeakers(eventId);
  }
}

