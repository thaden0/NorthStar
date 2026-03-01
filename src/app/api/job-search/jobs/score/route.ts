import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAgentClient } from '@/lib/agent-service';

/**
 * Background scoring function — processes ALL unscored jobs in batches of 9.
 * Runs after the HTTP response is sent so the browser never times out.
 */
async function scoreAllJobs(userId: string, userEmail: string, userName: string, model?: string) {
  const BATCH_SIZE = 9;

  console.log(`[Scoring] Starting background scoring for user ${userId}`);

  // Get the user's default resume once
  const resume = await db.resume.findFirst({
    where: { userId, isDefault: true },
    select: { name: true, fileData: true, skills: true, summary: true, experienceYears: true, targetRole: true },
  });

  let resumeContent: string | null = resume?.summary || null;
  if (!resumeContent && resume?.fileData) {
    try {
      const decoded = Buffer.from(resume.fileData, 'base64').toString('utf-8');
      resumeContent = decoded.substring(0, 3000);
    } catch {
      resumeContent = null;
    }
  }

  const experienceStr = resume?.experienceYears
    ? `${resume.experienceYears} years${resume.targetRole ? ` targeting ${resume.targetRole}` : ''}`
    : '';

  const agentClient = createAgentClient(userId, userEmail, userName);
  let totalScored = 0;

  // Loop until all jobs are scored
  while (true) {
    const unscoredJobs = await db.job.findMany({
      where: {
        userId,
        searchMatchScore: null,
        status: { not: 'hidden' },
      },
      include: { jobSearch: true },
      take: BATCH_SIZE,
      orderBy: { createdAt: 'desc' },
    });

    if (unscoredJobs.length === 0) {
      console.log(`[Scoring] Complete! Total scored: ${totalScored}`);
      break;
    }

    console.log(`[Scoring] Processing batch of ${unscoredJobs.length} jobs (${totalScored} scored so far)`);

    // Group by search criteria
    const jobsBySearch = new Map<string, typeof unscoredJobs>();
    for (const job of unscoredJobs) {
      const searchId = job.jobSearchId;
      if (!jobsBySearch.has(searchId)) {
        jobsBySearch.set(searchId, []);
      }
      jobsBySearch.get(searchId)!.push(job);
    }

    for (const [, jobs] of jobsBySearch) {
      const search = jobs[0].jobSearch;

      try {
        const result = await agentClient.scoreJobs({
          jobs: jobs.map((j: typeof jobs[0]) => ({
            id: j.id,
            title: j.title,
            company: j.company,
            location: j.location,
            description: j.description,
            salaryMin: j.salaryMin,
            salaryMax: j.salaryMax,
            salaryPeriod: j.salaryPeriod,
            jobType: j.jobType,
            remote: j.remote,
            experienceLevel: j.experienceLevel,
          })),
          searchCriteria: {
            keywords: search.keywords,
            locations: search.locations,
            jobTypes: search.jobTypes,
            remote: search.remote,
            salaryMin: search.salaryMin,
            salaryMax: search.salaryMax,
            experienceLevel: search.experienceLevel,
            excludeKeywords: search.excludeKeywords,
          },
          resume: resume ? {
            name: resume.name,
            content: resumeContent,
            skills: resume.skills || [],
            experience: experienceStr,
          } : null,
          model: model || undefined,
        });

        // Save scores to database
        for (const score of result.results) {
          await db.job.update({
            where: { id: score.jobId },
            data: {
              searchMatchScore: score.searchMatchScore,
              candidateMatchScore: score.candidateMatchScore,
              aiNotes: score.notes,
              aiScore: Math.round((score.searchMatchScore + score.candidateMatchScore) / 2),
              aiScoredAt: new Date(),
            },
          });
          totalScored++;
        }
        console.log(`[Scoring] Batch done, ${totalScored} total scored`);
      } catch (error) {
        console.error(`[Scoring] Error scoring batch for "${search.name}":`, error);
        // Mark these jobs so we don't retry them forever in this run
        for (const job of jobs) {
          await db.job.update({
            where: { id: job.id },
            data: {
              searchMatchScore: -1,
              candidateMatchScore: -1,
              aiNotes: 'Scoring failed - will retry',
              aiScoredAt: new Date(),
            },
          });
        }
      }
    }
  }

  // Clean up sentinel values so failed jobs get retried next time
  await db.job.updateMany({
    where: { userId, searchMatchScore: -1 },
    data: { searchMatchScore: null, candidateMatchScore: null, aiScoredAt: null, aiNotes: null },
  });

  return totalScored;
}

/**
 * POST /api/job-search/jobs/score
 * Kicks off background scoring of ALL unscored jobs and returns immediately.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { model } = body || {};

    // Count how many need scoring
    const unscoredCount = await db.job.count({
      where: {
        userId: session.userId,
        searchMatchScore: null,
        status: { not: 'hidden' },
      },
    });

    if (unscoredCount === 0) {
      return NextResponse.json({
        message: 'All jobs already scored',
        scored: 0,
        total: 0,
      });
    }

    // Fire and forget — scoring runs in the background
    scoreAllJobs(
      session.userId,
      session.user.email,
      session.user.name || 'User',
      model,
    ).catch(err => {
      console.error('[Scoring] Background scoring failed:', err);
    });

    return NextResponse.json({
      message: `Scoring ${unscoredCount} jobs in background...`,
      scored: 0,
      total: unscoredCount,
      background: true,
    });
  } catch (error) {
    console.error('Job scoring error:', error);
    return NextResponse.json({ error: 'Failed to start scoring' }, { status: 500 });
  }
}
