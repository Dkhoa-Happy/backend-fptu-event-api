import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { EventStatus } from '@prisma/client';

export class UpdateEventStatusDto {
  @ApiProperty({
    enum: [EventStatus.PUBLISHED, EventStatus.CANCELED],
    example: EventStatus.PUBLISHED,
    description:
      'New status for the event (PUBLISHED or CANCELED). Only admin can change event status.',
  })
  @IsEnum([EventStatus.PUBLISHED, EventStatus.CANCELED], {
    message: 'Status must be either PUBLISHED or CANCELED',
  })
  @IsNotEmpty({ message: 'Status is required' })
  status: EventStatus;
}
