import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  Max,
  IsUUID,
  IsBoolean,
} from 'class-validator';

export class CreateFeedbackDto {
  @ApiProperty({
    description: 'Đánh giá sự kiện (1-5 sao)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    description: 'Nhận xét về sự kiện',
    example: 'Sự kiện rất hay và bổ ích',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({
    description: 'ID của sự kiện',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  eventId: string;

  @ApiProperty({
    description:
      'Bỏ qua kiểm tra thời gian sự kiện (true: không cần sự kiện sắp kết thúc, false: chỉ được feedback khi sự kiện sắp kết thúc hoặc đã kết thúc)',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  skipTimeValidation?: boolean;
}
