import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestCancellationDto {
  @ApiProperty({
    description: 'Lý do hủy sự kiện',
    example: 'Sự kiện không thể tổ chức do vấn đề về địa điểm',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty({ message: 'Lý do hủy sự kiện không được để trống' })
  @MinLength(10, { message: 'Lý do hủy sự kiện phải có ít nhất 10 ký tự' })
  reason: string;
}
