import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SubmitOrganizerRequestDto {
  @ApiProperty({ example: 'CLB Âm nhạc FPT' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'Câu lạc bộ giao lưu, biểu diễn âm nhạc' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: 'https://example.com/logo.png',
    required: false,
    description: 'Logo của câu lạc bộ (tùy chọn)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  logoUrl?: string;

  @ApiProperty({ example: 'musicclub@fpt.edu.vn' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({
    example: 1,
    description: 'Campus ID nơi câu lạc bộ trực thuộc',
  })
  @IsInt()
  campusId: number;

  @ApiProperty({
    example: 'https://example.com/proof.png',
    description: 'Ảnh chứng nhận/bổ nhiệm trưởng câu lạc bộ',
  })
  @IsString()
  @IsNotEmpty()
  proofImageUrl: string;

  @ApiProperty({
    required: false,
    type: [String],
    description:
      'Danh sách email thành viên CLB (sẽ được tạo/nâng cấp thành staff khi request được duyệt)',
    example: ['member1@fpt.edu.vn', 'member2@fpt.edu.vn'],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  memberEmails?: string[];
}

