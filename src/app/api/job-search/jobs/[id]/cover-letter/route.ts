import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAgentClient } from '@/lib/agent-service';

/**
 * GET /api/job-search/jobs/[id]/cover-letter
 * Get existing cover letter for a job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const coverLetter = await db.coverLetter.findUnique({
      where: { jobId: id },
    });

    if (!coverLetter) {
      return NextResponse.json({ error: 'No cover letter found' }, { status: 404 });
    }

    return NextResponse.json(coverLetter);
  } catch (error) {
    console.error('Get cover letter error:', error);
    return NextResponse.json({ error: 'Failed to get cover letter' }, { status: 500 });
  }
}

/**
 * POST /api/job-search/jobs/[id]/cover-letter
 * Generate a new cover letter for a job using AI
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Get the job
    const job = await db.job.findFirst({
      where: { id, userId: session.userId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get ALL user resumes for comprehensive context
    const resumes = await db.resume.findMany({
      where: { userId: session.userId, isActive: true },
      select: {
        name: true,
        targetRole: true,
        skills: true,
        experienceYears: true,
        summary: true,
        fileData: true,
      },
    });

    // Build resume contexts — use summary or truncated text
    const resumeContexts = resumes.map(r => {
      let content: string | null = r.summary || null;
      if (!content && r.fileData) {
        try {
          const decoded = Buffer.from(r.fileData, 'base64').toString('utf-8');
          content = decoded.substring(0, 3000);
        } catch {
          content = null;
        }
      }
      return {
        name: r.name,
        targetRole: r.targetRole,
        skills: r.skills || [],
        experienceYears: r.experienceYears,
        summary: r.summary,
        content,
      };
    });

    // Call Agent Service
    const agentClient = createAgentClient(
      session.userId,
      session.user.email,
      session.user.name || 'User',
    );

    const result = await agentClient.generateCoverLetter({
      job: {
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        jobType: job.jobType,
        remote: job.remote,
        experienceLevel: job.experienceLevel,
      },
      resumes: resumeContexts,
      userName: session.user.name || 'User',
      model: body.model || undefined,
    });

    // Check if cover letter already exists for this job
    const existing = await db.coverLetter.findUnique({
      where: { jobId: id },
    });

    let coverLetter;
    if (existing) {
      // Update existing
      coverLetter = await db.coverLetter.update({
        where: { jobId: id },
        data: {
          content: result.content,
          model: result.model,
          version: existing.version + 1,
        },
      });
    } else {
      // Create new
      coverLetter = await db.coverLetter.create({
        data: {
          userId: session.userId,
          jobId: id,
          content: result.content,
          model: result.model,
        },
      });
    }

    return NextResponse.json(coverLetter);
  } catch (error) {
    console.error('Generate cover letter error:', error);
    return NextResponse.json(
      { error: 'Failed to generate cover letter' },
      { status: 500 },
    );
  }
}
