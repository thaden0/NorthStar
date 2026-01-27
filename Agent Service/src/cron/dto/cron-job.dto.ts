import { IsString, IsOptional, IsBoolean, IsNumber, IsIn, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCronJobDto {
  @ApiProperty({ description: 'Name of the scheduled task' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Description of what this task does' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'The prompt to execute' })
  @IsString()
  prompt: string;

  @ApiProperty({ 
    description: 'Type of schedule',
    enum: ['cron', 'once', 'recurring']
  })
  @IsIn(['cron', 'once', 'recurring'])
  scheduleType: 'cron' | 'once' | 'recurring';

  @ApiPropertyOptional({ description: 'Cron expression (for cron type)', example: '0 9 * * 5' })
  @ValidateIf(o => o.scheduleType === 'cron')
  @IsString()
  cronExpression?: string;

  @ApiPropertyOptional({ description: 'Scheduled datetime (for once type)', example: '2024-02-14T14:00:00Z' })
  @ValidateIf(o => o.scheduleType === 'once')
  @IsString()
  scheduledAt?: string;

  @ApiPropertyOptional({ 
    description: 'Recurring pattern',
    enum: ['daily', 'weekly', 'biweekly', 'monthly', 'weekdays', 'weekends']
  })
  @ValidateIf(o => o.scheduleType === 'recurring')
  @IsIn(['daily', 'weekly', 'biweekly', 'monthly', 'weekdays', 'weekends'])
  recurringPattern?: string;

  @ApiPropertyOptional({ description: 'Day of week (0-6) or day of month (1-31)' })
  @IsOptional()
  @IsNumber()
  recurringDay?: number;

  @ApiPropertyOptional({ description: 'Time in HH:MM format', example: '09:00' })
  @IsOptional()
  @IsString()
  recurringTime?: string;

  @ApiPropertyOptional({ description: 'Timezone', example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Whether the job is enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateCronJobDto {
  @ApiPropertyOptional({ description: 'Name of the scheduled task' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Description of what this task does' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'The prompt to execute' })
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiPropertyOptional({ 
    description: 'Type of schedule',
    enum: ['cron', 'once', 'recurring']
  })
  @IsOptional()
  @IsIn(['cron', 'once', 'recurring'])
  scheduleType?: 'cron' | 'once' | 'recurring';

  @ApiPropertyOptional({ description: 'Cron expression (for cron type)' })
  @IsOptional()
  @IsString()
  cronExpression?: string;

  @ApiPropertyOptional({ description: 'Scheduled datetime (for once type)' })
  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @ApiPropertyOptional({ 
    description: 'Recurring pattern',
    enum: ['daily', 'weekly', 'biweekly', 'monthly', 'weekdays', 'weekends']
  })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'biweekly', 'monthly', 'weekdays', 'weekends'])
  recurringPattern?: string;

  @ApiPropertyOptional({ description: 'Day of week (0-6) or day of month (1-31)' })
  @IsOptional()
  @IsNumber()
  recurringDay?: number;

  @ApiPropertyOptional({ description: 'Time in HH:MM format' })
  @IsOptional()
  @IsString()
  recurringTime?: string;

  @ApiPropertyOptional({ description: 'Timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Whether the job is enabled' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
