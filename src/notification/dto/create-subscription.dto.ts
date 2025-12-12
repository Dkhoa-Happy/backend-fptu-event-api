import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({
    example: 'c1a2b3c4-d5e6-7890-1234-abcdefabcdef',
    description: 'OneSignal subscription/player ID',
  })
  @IsString()
  @IsNotEmpty()
  subscriptionId: string;

  @ApiProperty({
    example: 'expo-device-id-or-web-client-id',
    description: 'Device identifier (optional, for debugging)',
    required: false,
  })
  @IsString()
  @IsOptional()
  deviceId?: string;
}


