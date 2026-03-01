import { Controller, Post, Body, Logger } from '@nestjs/common';

import { CoverLetterService } from './cover-letter.service';

@Controller('cover-letter')
export class CoverLetterController {
  private readonly logger = new Logger(CoverLetterController.name);

  constructor(private readonly coverLetterService: CoverLetterService) {}

  @Post('generate')
  async generateCoverLetter(
    @Body()
    body: {
      job: {
        title: string;
        company: string;
        location: string | null;
        description: string | null;
        jobType: string | null;
        remote: string | null;
        experienceLevel: string | null;
      };
      resumes: Array<{
        name: string;
        targetRole: string | null;
        skills: string[];
        experienceYears: number | null;
        summary: string | null;
        content: string | null;
      }>;
      userName: string;
      model?: string;
    },
  ) {
    this.logger.log(
      `Generating cover letter for "${body.job.title}" at ${body.job.company} (${body.resumes.length} resumes)`,
    );

    const result = await this.coverLetterService.generateCoverLetter(body);

    return {
      success: true,
      data: {
        content: result.content,
        model: result.model,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}
