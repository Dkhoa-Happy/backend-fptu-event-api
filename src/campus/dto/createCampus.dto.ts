import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCampusDto {
  @ApiProperty({
    description: 'Tên Campus',
    example: 'FU - Hòa Lạc, FU - Nhà văn hóa sinh viên TP.HCM, ...',
  })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Mã campus', example: 'FU-HL, NVH, FU-HCM, ...' })
  @IsString()
  code: string;

  @ApiProperty({
    description: 'Sức chứa campus',
    example: '2000',
    required: false,
  })
  @IsOptional()
  @IsInt({ message: 'Sức chứa phải là một số nguyên' })
  capacity?: number;

  @ApiProperty({
    description: 'Địa chỉ campus',
    required: false,
    example: '39/5 Trương Văn Hải, Hồ Chí Minh',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: 'URL hình ảnh campus',
    required: false,
    example: 'https://example.com/campus.jpg',
  })
  @IsOptional()
  @IsString()
  image?: string;
}
