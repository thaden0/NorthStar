import { Controller, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JobScoringService } from './job-scoring.service';

export interface JobScoringRequestDto {
  jobs: Array<{
    id: string;
    title: string;
    company: string;
    location: string | null;
    description: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryPeriod: string | null;
    jobType: string | null;
    remote: string | null;
    experienceLevel: string | null;
  }>;
  searchCriteria: {
    keywords: string[];
    locations: string[];
    jobTypes: string[];
    remote: string;
    salaryMin: number | null;
    salaryMax: number | null;
    experienceLevel: string | null;
    excludeKeywords: string[];
  };
  resume: {
    name: string;
    content: string | null; // Resume text content if available
    skills: string[];
    experience: string;
  } | null;
  model?: string;
}

export interface JobScoreResult {
  jobId: string;
  searchMatchScore: number;   // 0-100
  candidateMatchScore: number; // 0-100
  notes: string;
}

@ApiTags('Job Scoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('job-scoring')
export class JobScoringController {
  private readonly logger = new Logger(JobScoringController.name);

  constructor(private readonly scoringService: JobScoringService) {}

  @Post('score')
  async scoreJobs(@Body() dto: JobScoringRequestDto): Promise<{
    success: boolean;
    data: {
      results: JobScoreResult[];
      model: string;
      scoredAt: string;
    };
  }> {
    this.logger.log(`Scoring ${dto.jobs.length} jobs against search criteria`);
    
    const results = await this.scoringService.scoreJobs(dto);
    
    return {
      success: true,
      data: {
        results,
        model: dto.model || 'phi4:latest',
        scoredAt: new Date().toISOString(),
      },
    };
  }
}
