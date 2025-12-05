import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto, UpdateFeedbackDto } from './dto';
import { GetUser } from '../auth/decorator';
import { JwtGuard } from '../auth/guard/jwt.guard';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo feedback cho sự kiện (yêu cầu đăng nhập)' })
  createFeedback(
    @Body() dto: CreateFeedbackDto,
    @GetUser('id') userId: number,
  ) {
    return this.feedbackService.createFeedback(dto, userId);
  }

  @Get('event/:eventId')
  @ApiOperation({ summary: 'Lấy danh sách feedback theo event ID' })
  getFeedbacksByEventId(@Param('eventId') eventId: string) {
    return this.feedbackService.getFeedbacksByEventId(eventId);
  }

  @Get('my-feedbacks')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách feedback của tôi' })
  getMyFeedbacks(@GetUser('id') userId: number) {
    return this.feedbackService.getMyFeedbacks(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin feedback theo ID' })
  getFeedbackById(@Param('id') id: string) {
    return this.feedbackService.getFeedbackById(parseInt(id));
  }

  @Patch(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật feedback (chỉ người tạo)' })
  updateFeedback(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackDto,
    @GetUser('id') userId: number,
  ) {
    return this.feedbackService.updateFeedback(parseInt(id), dto, userId);
  }

  @Delete(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa feedback (chỉ người tạo)' })
  deleteFeedback(@Param('id') id: string, @GetUser('id') userId: number) {
    return this.feedbackService.deleteFeedback(parseInt(id), userId);
  }
}
