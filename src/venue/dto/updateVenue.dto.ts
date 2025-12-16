import { IsString, IsInt, IsBoolean, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateVenueDto {
  @ApiProperty({
    description: 'Tên venue',
    example: 'Hội trường A',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Địa chỉ/vị trí venue',
    example: 'Tầng 3, Nhà A, FU Hòa Lạc',
    required: false,
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({
    description: 'URL hình ảnh bản đồ ghế',
    required: false,
    example: 'https://example.com/map.png',
  })
  @IsOptional()
  @IsString()
  mapImageUrl?: string;

  @ApiProperty({
    description: 'Sức chứa tối đa của venue',
    required: false,
    example: 200,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;
}
