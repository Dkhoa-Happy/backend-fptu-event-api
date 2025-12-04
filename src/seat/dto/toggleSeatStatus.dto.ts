import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleSeatStatusDto {
  @ApiProperty({
    description: 'Trạng thái active của ghế (true: active, false: deactive)',
    example: true,
  })
  @IsBoolean()
  isActive: boolean;
}
