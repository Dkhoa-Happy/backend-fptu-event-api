import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class TestSendDto {
  @ApiProperty({ example: 'event-uuid', description: 'Event ID' })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({
    example: 'one_day',
    enum: ['one_day', 'thirty_min'],
    description: 'Notification window to trigger',
  })
  @IsEnum(['one_day', 'thirty_min'])
  type: 'one_day' | 'thirty_min';
}
