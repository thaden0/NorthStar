import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ description: 'User ID to send notification to' })
  @IsString()
  userId: string;

  @ApiProperty({ 
    description: 'Type of notification',
    enum: ['cron_result', 'cron_error', 'system', 'alert', 'info']
  })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification message content' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Additional structured data' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
