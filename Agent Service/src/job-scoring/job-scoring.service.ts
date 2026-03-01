import { Injectable, Logger } from '@nestjs/common';
import { OllamaService } from '../llm/ollama.service';
import { JobScoringRequestDto, JobScoreResult } from './job-scoring.controller';

@Injectable()
export class JobScoringService {
  private readonly logger = new Logger(JobScoringService.name);

  constructor(private readonly ollamaService: OllamaService) {}

  async scoreJobs(dto: JobScoringRequestDto): Promise<JobScoreResult[]> {
    const model = dto.model || 'qwen3:latest';
    const results: JobScoreResult[] = [];

    // Build context about the search and candidate
    const searchContext = this.buildSearchContext(dto.searchCriteria);
    const resumeContext = this.buildResumeContext(dto.resume);

    // Score jobs in batches to avoid overwhelming the LLM
    const batchSize = 3;
    for (let i = 0; i < dto.jobs.length; i += batchSize) {
      const batch = dto.jobs.slice(i, i + batchSize);
      
      try {
        const batchResults = await this.scoreBatch(batch, searchContext, resumeContext, model);
        results.push(...batchResults);
      } catch (error) {
        this.logger.error(`Error scoring batch ${i / batchSize + 1}: ${error}`);
        // Return default scores for failed batch
        for (const job of batch) {
          results.push({
            jobId: job.id,
            searchMatchScore: 0,
            candidateMatchScore: 0,
            notes: 'Scoring failed - will retry on next refresh',
          });
        }
      }
    }

    return results;
  }

  private async scoreBatch(
    jobs: JobScoringRequestDto['jobs'],
    searchContext: string,
    resumeContext: string,
    model: string,
  ): Promise<JobScoreResult[]> {
    const jobDescriptions = jobs.map((job, idx) => {
      const parts = [
        `JOB ${idx + 1} (ID: ${job.id}):`,
        `  Title: ${job.title}`,
        `  Company: ${job.company}`,
        `  Location: ${job.location || 'Not specified'}`,
        `  Type: ${job.jobType || 'Not specified'}`,
        `  Remote: ${job.remote || 'Not specified'}`,
        `  Experience: ${job.experienceLevel || 'Not specified'}`,
      ];
      if (job.salaryMin || job.salaryMax) {
        parts.push(`  Salary: ${job.salaryMin ? '$' + job.salaryMin : '?'} - ${job.salaryMax ? '$' + job.salaryMax : '?'} ${job.salaryPeriod || ''}`);
      }
      if (job.description) {
        parts.push(`  Description: ${job.description.substring(0, 500)}`);
      }
      return parts.join('\n');
    }).join('\n\n');

    const systemPrompt = `You are a job matching AI assistant. You analyze job listings and provide two numerical scores for each job.

SCORING CRITERIA:

1. **Search Match Score (0-100)**: How well does this job match the SEARCH CRITERIA the user defined?
   - Keywords alignment (do the job title/description contain the search keywords?)
   - Location match (is the job in or near the specified locations?)
   - Job type match (full-time, part-time, contract, etc.)
   - Remote preference match
   - Salary range overlap
   - Experience level match
   - Score 90-100: Perfect match on almost all criteria
   - Score 70-89: Strong match, most criteria met
   - Score 50-69: Moderate match, some criteria met
   - Score 30-49: Weak match, few criteria met
   - Score 0-29: Poor match, barely relevant

2. **Candidate Match Score (0-100)**: How well does the CANDIDATE (based on their resume/profile) match the job's requirements?
   - Skills alignment
   - Experience level match
   - Industry relevance
   - If no resume is provided, estimate based on the search criteria they've defined (assume they're searching for roles they're qualified for, give moderate scores of 50-65)
   - Score 90-100: Exceptional match, overqualified or perfect fit
   - Score 70-89: Strong candidate, meets most requirements
   - Score 50-69: Decent match, meets some requirements
   - Score 30-49: Stretch role, missing key qualifications
   - Score 0-29: Not qualified

IMPORTANT: You MUST respond with ONLY valid JSON matching this exact format. No other text before or after.
{
  "scores": [
    {
      "jobId": "<the exact job ID>",
      "searchMatchScore": <number 0-100>,
      "candidateMatchScore": <number 0-100>,
      "notes": "<brief 1-2 sentence explanation>"
    }
  ]
}`;

    const userPrompt = `${searchContext}

${resumeContext}

---

JOBS TO SCORE:

${jobDescriptions}

Respond with ONLY the JSON scores object. No markdown, no explanation, no thinking, just the JSON. /no_think`;

    try {
      const result = await this.ollamaService.rawChat({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Low temperature for consistent scoring
      });

      // Parse JSON from response, handling potential markdown wrapping
      let content = result.content.trim();
      
      // Strip qwen3 thinking tags if present
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      
      // Strip markdown code fences if present
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      // Try to extract JSON from the response
      // Handle both {scores: [...]} and bare [...] formats
      let scores: Array<{
        jobId: string;
        searchMatchScore: number;
        candidateMatchScore: number;
        notes: string;
      }> = [];

      // Try wrapped format first: {"scores": [...]}
      const wrappedMatch = content.match(/\{[\s\S]*"scores"[\s\S]*\}/);
      if (wrappedMatch) {
        try {
          const parsed = JSON.parse(wrappedMatch[0]);
          scores = parsed.scores || [];
        } catch {
          // Fall through to array parsing
        }
      }
      
      // Try bare array format: [{...}, {...}]
      if (scores.length === 0) {
        const arrayMatch = content.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          try {
            scores = JSON.parse(arrayMatch[0]);
          } catch {
            // Fall through to default
          }
        }
      }

      if (scores.length === 0) {
        this.logger.warn(`Failed to extract scores from response: ${content.substring(0, 200)}`);
        return jobs.map(job => ({
          jobId: job.id,
          searchMatchScore: 50,
          candidateMatchScore: 50,
          notes: 'Could not parse AI response, default scores assigned',
        }));
      }

      // Map parsed results back to jobs, ensuring all jobs get a score
      return jobs.map(job => {
        const score = scores.find(s => s.jobId === job.id);
        if (score) {
          return {
            jobId: job.id,
            searchMatchScore: Math.max(0, Math.min(100, Math.round(score.searchMatchScore))),
            candidateMatchScore: Math.max(0, Math.min(100, Math.round(score.candidateMatchScore))),
            notes: score.notes || '',
          };
        }
        return {
          jobId: job.id,
          searchMatchScore: 50,
          candidateMatchScore: 50,
          notes: 'Score not returned by AI, default assigned',
        };
      });

    } catch (error) {
      this.logger.error(`LLM scoring error: ${error}`);
      throw error;
    }
  }

  private buildSearchContext(criteria: JobScoringRequestDto['searchCriteria']): string {
    const parts = ['SEARCH CRITERIA (what the user is looking for):'];
    parts.push(`  Keywords: ${criteria.keywords.join(', ')}`);
    if (criteria.locations.length > 0) parts.push(`  Locations: ${criteria.locations.join(', ')}`);
    if (criteria.jobTypes.length > 0) parts.push(`  Job Types: ${criteria.jobTypes.join(', ')}`);
    if (criteria.remote !== 'any') parts.push(`  Remote Preference: ${criteria.remote}`);
    if (criteria.salaryMin) parts.push(`  Min Salary: $${criteria.salaryMin}`);
    if (criteria.salaryMax) parts.push(`  Max Salary: $${criteria.salaryMax}`);
    if (criteria.experienceLevel) parts.push(`  Experience Level: ${criteria.experienceLevel}`);
    if (criteria.excludeKeywords.length > 0) parts.push(`  Excluding: ${criteria.excludeKeywords.join(', ')}`);
    return parts.join('\n');
  }

  private buildResumeContext(resume: JobScoringRequestDto['resume']): string {
    if (!resume) {
      return 'CANDIDATE PROFILE: No resume provided. Use search criteria to estimate candidate qualifications.';
    }
    
    const parts = ['CANDIDATE PROFILE:'];
    parts.push(`  Resume Name: ${resume.name}`);
    if (resume.skills.length > 0) parts.push(`  Skills: ${resume.skills.join(', ')}`);
    if (resume.experience) parts.push(`  Experience: ${resume.experience}`);
    if (resume.content) parts.push(`  Resume Content: ${resume.content.substring(0, 1500)}`);
    return parts.join('\n');
  }
}
