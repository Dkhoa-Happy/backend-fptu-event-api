import { Module } from '@nestjs/common';
import { CheckinLogController } from './checkin-log.controller';
import { CheckinLogService } from './checkin-log.service';

@Module({
  controllers: [CheckinLogController],
  providers: [CheckinLogService],
  exports: [CheckinLogService],
})
export class CheckinLogModule {}

