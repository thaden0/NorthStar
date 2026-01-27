import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CronJobsService } from './cron-jobs.service';
import { SchedulerService } from './scheduler.service';
import { CreateCronJobDto, UpdateCronJobDto } from './dto/cron-job.dto';

@ApiTags('Cron Jobs')
@Controller('cron-jobs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CronJobsController {
  constructor(
    private readonly cronJobsService: CronJobsService,
    private readonly schedulerService: SchedulerService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new scheduled task' })
  async create(@Request() req: any, @Body() dto: CreateCronJobDto) {
    const userId = req.user?.sub || req.user?.id;
    const job = await this.cronJobsService.create(userId, dto);
    return { success: true, data: job };
  }

  @Get()
  @ApiOperation({ summary: 'List all scheduled tasks for the current user' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID (admin only)' })
  async findAll(@Request() req: any, @Query('userId') filterUserId?: string) {
    const userId = filterUserId || req.user?.sub || req.user?.id;
    const jobs = await this.cronJobsService.findAllByUser(userId);
    return { success: true, data: jobs };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific scheduled task' })
  @ApiParam({ name: 'id', type: 'string' })
  async findOne(@Param('id') id: string) {
    const job = await this.cronJobsService.findOne(id);
    return { success: true, data: job };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a scheduled task' })
  @ApiParam({ name: 'id', type: 'string' })
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCronJobDto,
  ) {
    const userId = req.user?.sub || req.user?.id;
    const job = await this.cronJobsService.update(id, userId, dto);
    return { success: true, data: job };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a scheduled task' })
  @ApiParam({ name: 'id', type: 'string' })
  async delete(@Request() req: any, @Param('id') id: string) {
    const userId = req.user?.sub || req.user?.id;
    await this.cronJobsService.delete(id, userId);
    return { success: true, message: 'Scheduled task deleted' };
  }

  @Post(':id/run')
  @ApiOperation({ summary: 'Manually trigger a scheduled task' })
  @ApiParam({ name: 'id', type: 'string' })
  async triggerRun(@Param('id') id: string) {
    const result = await this.schedulerService.triggerJob(id);
    return { success: true, message: 'Task triggered', data: result };
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'Get execution history for a scheduled task' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiQuery({ name: 'limit', required: false, type: 'number', description: 'Max results (default 20)' })
  async getExecutions(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const executions = await this.cronJobsService.getExecutions(
      id, 
      limit ? parseInt(limit, 10) : 20
    );
    return { success: true, data: executions };
  }
}
