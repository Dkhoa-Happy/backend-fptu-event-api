import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrganizerRequestService } from './organizer-request.service';
import { GetUser, Roles } from '../auth/decorator';
import { JwtGuard, RolesGuard } from '../auth/guard';
import { UserRole } from '@prisma/client';
import {
  QueryOrganizerRequestDto,
  ReviewOrganizerRequestDto,
  SubmitOrganizerRequestDto,
} from './dto';

@ApiTags('organizer-requests')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Controller('organizer-requests')
export class OrganizerRequestController {
  constructor(
    private readonly organizerRequestService: OrganizerRequestService,
  ) {}

  @Post()
  @Roles(UserRole.student)
  @ApiOperation({
    summary:
      'Student gửi yêu cầu trở thành organizer kèm minh chứng',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ student được phép gửi yêu cầu',
  })
  @ApiResponse({ status: 201, description: 'Yêu cầu đã được gửi' })
  submit(
    @GetUser('id') userId: number,
    @Body() dto: SubmitOrganizerRequestDto,
  ) {
    return this.organizerRequestService.submit(userId, dto);
  }

  @Get()
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Admin xem danh sách yêu cầu trở thành organizer',
  })
  @ApiForbiddenResponse({ description: 'Chỉ admin được phép xem' })
  @ApiResponse({ status: 200, description: 'Danh sách yêu cầu' })
  list(@Query() query: QueryOrganizerRequestDto) {
    return this.organizerRequestService.listForAdmin(query);
  }

  @Patch(':id/review')
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Admin duyệt / từ chối yêu cầu và nâng cấp role',
  })
  @ApiForbiddenResponse({ description: 'Chỉ admin được phép duyệt' })
  @ApiResponse({ status: 200, description: 'Kết quả duyệt' })
  review(
    @Param('id', ParseIntPipe) id: number,
    @GetUser('id') adminId: number,
    @Body() dto: ReviewOrganizerRequestDto,
  ) {
    return this.organizerRequestService.review(id, adminId, dto);
  }
}

