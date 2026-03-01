import { Controller, Post, Body, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { JobApplyService, ApplyRequest, ApplicationStep } from './job-apply.service';

@Controller('job-apply')
export class JobApplyController {
  private readonly logger = new Logger(JobApplyController.name);

  constructor(private readonly jobApplyService: JobApplyService) {}

  /**
   * POST /job-apply/start
   * Start applying to a job — returns SSE stream of steps
   */
  @Post('start')
  async startApplication(
    @Body() body: ApplyRequest,
    @Res() res: Response,
  ) {
    this.logger.log(`Starting application for "${body.job.title}" at ${body.job.company}`);

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const onStep = (step: ApplicationStep) => {
      res.write(`data: ${JSON.stringify({ type: 'step', step })}\n\n`);
    };

    try {
      const result = await this.jobApplyService.applyToJob(body, onStep);

      // Send final result
      res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
      res.end();
    } catch (error) {
      this.logger.error(`Application failed: ${error}`);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      })}\n\n`);
      res.end();
    }
  }

  /**
   * POST /job-apply/status
   * Quick test endpoint
   */
  @Post('status')
  async getStatus(@Body() body: { jobId: string }) {
    return { success: true, data: { jobId: body.jobId, status: 'ready' } };
  }
}
