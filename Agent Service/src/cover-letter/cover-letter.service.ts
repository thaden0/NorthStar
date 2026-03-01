import { Injectable, Logger } from '@nestjs/common';
import { OllamaService } from '../llm/ollama.service';

interface ResumeContext {
  name: string;
  targetRole: string | null;
  skills: string[];
  experienceYears: number | null;
  summary: string | null;
  content: string | null;
}

interface CoverLetterRequest {
  job: {
    title: string;
    company: string;
    location: string | null;
    description: string | null;
    jobType: string | null;
    remote: string | null;
    experienceLevel: string | null;
  };
  resumes: ResumeContext[];
  userName: string;
  model?: string;
}

@Injectable()
export class CoverLetterService {
  private readonly logger = new Logger(CoverLetterService.name);
  private readonly defaultModel = 'mistral-nemo:latest';

  constructor(private readonly ollamaService: OllamaService) {}

  async generateCoverLetter(request: CoverLetterRequest): Promise<{
    content: string;
    model: string;
  }> {
    const model = request.model || this.defaultModel;
    this.logger.log(`Generating cover letter for "${request.job.title}" at ${request.job.company} using ${model}`);

    // Build comprehensive resume context from ALL resumes
    const resumeContext = request.resumes.map((r, i) => {
      const parts = [`Resume ${i + 1}: "${r.name}"`];
      if (r.targetRole) parts.push(`  Target Role: ${r.targetRole}`);
      if (r.experienceYears) parts.push(`  Experience: ${r.experienceYears} years`);
      if (r.skills.length > 0) parts.push(`  Skills: ${r.skills.join(', ')}`);
      if (r.summary) parts.push(`  Summary: ${r.summary}`);
      if (r.content) parts.push(`  Details:\n${r.content}`);
      return parts.join('\n');
    }).join('\n\n');

    // Build job context
    const jobParts = [
      `Title: ${request.job.title}`,
      `Company: ${request.job.company}`,
    ];
    if (request.job.location) jobParts.push(`Location: ${request.job.location}`);
    if (request.job.jobType) jobParts.push(`Type: ${request.job.jobType}`);
    if (request.job.remote) jobParts.push(`Remote: ${request.job.remote}`);
    if (request.job.experienceLevel) jobParts.push(`Level: ${request.job.experienceLevel}`);
    if (request.job.description) jobParts.push(`\nJob Description:\n${request.job.description}`);
    const jobContext = jobParts.join('\n');

    const systemPrompt = `You are a professional cover letter writer. Write compelling, tailored cover letters that:
- Are addressed to the hiring manager at the company
- Open with a strong, specific hook mentioning the role and company
- Highlight the most relevant skills and experience from the candidate's background
- Connect the candidate's qualifications directly to the job requirements
- Show genuine interest in the company and role
- Close with a confident call to action
- Are 3-4 paragraphs, professional but personable
- Do NOT use generic filler phrases like "I am writing to express my interest"
- Do NOT include placeholder text like [Your Name] — use the real name provided
- Output ONLY the cover letter text, no headers, no "Subject:" line, no metadata`;

    const userPrompt = `Write a cover letter for ${request.userName} applying for this position:

--- JOB ---
${jobContext}

--- CANDIDATE BACKGROUND ---
${resumeContext}

Write the cover letter now. Start with "Dear Hiring Manager," and end with a professional sign-off using the name "${request.userName}". /no_think`;

    try {
      // Check if model exists, fall back to qwen3 if not
      let useModel = model;
      const exists = await this.ollamaService.checkModelExists(model);
      if (!exists) {
        this.logger.warn(`Model ${model} not found, falling back to qwen3:latest`);
        useModel = 'qwen3:latest';
      }

      const result = await this.ollamaService.rawChat({
        model: useModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      });

      // Strip think tags if present (qwen3)
      let content = result.content.trim();
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      // Strip any markdown code fences
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:\w+)?\n?/, '').replace(/\n?```$/, '');
      }

      this.logger.log(`Cover letter generated: ${content.length} chars using ${useModel}`);

      return {
        content,
        model: useModel,
      };
    } catch (error) {
      this.logger.error(`Failed to generate cover letter: ${error}`);
      throw error;
    }
  }
}
