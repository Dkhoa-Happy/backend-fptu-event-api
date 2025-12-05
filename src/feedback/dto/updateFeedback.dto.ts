import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

export class UpdateFeedbackDto {
  @ApiProperty({
    description: 'Đánh giá sự kiện (1-5 sao)',
    example: 5,
    minimum: 1,
    maximum: 5,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({
    description: 'Nhận xét về sự kiện',
    example: 'Sự kiện rất hay và bổ ích',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
