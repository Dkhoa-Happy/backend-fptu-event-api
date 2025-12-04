import { IsString, IsInt, IsBoolean, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVenueDto {
  @ApiProperty({
    description: 'Tên venue',
    example: 'Hội trường A',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Địa chỉ/vị trí venue',
    example: 'Tầng 3, Nhà A, FU Hòa Lạc',
  })
  @IsString()
  location: string;

  @ApiProperty({
    description: 'Số hàng ghế',
    example: 10,
  })
  @IsInt()
  @Min(1)
  row: number;

  @ApiProperty({
    description: 'Số cột ghế',
    example: 10,
  })
  @IsInt()
  @Min(1)
  column: number;

  @ApiProperty({
    description: 'Sức chứa venue',
    example: '500',
  })
  @IsInt()
  capacity: number;

  @ApiProperty({
    description: 'Venue có ghế hay không',
    example: true,
  })
  @IsBoolean()
  hasSeats: boolean;

  @ApiProperty({
    description: 'URL hình ảnh bản đồ ghế',
    required: false,
    example: 'https://example.com/map.png',
  })
  @IsOptional()
  @IsString()
  mapImageUrl?: string;

  @ApiProperty({
    description: 'ID Campus',
    example: 1,
  })
  @IsInt()
  campusId: number;
}
