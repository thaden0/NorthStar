import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAgentClient } from '@/lib/agent-service';

/**
 * POST /api/job-search/jobs/score
 * Score unscored jobs using the AI Agent Service
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { model } = body || {};

    // Find unscored jobs (no searchMatchScore) for this user, with their search criteria
    const unscoredJobs = await db.job.findMany({
      where: {
        userId: session.userId,
        searchMatchScore: null,
        status: { not: 'hidden' },
      },
      include: {
        jobSearch: true,
      },
      take: 30, // Process in batches of 30
      orderBy: { createdAt: 'desc' },
    });

    if (unscoredJobs.length === 0) {
      return NextResponse.json({ 
        message: 'No unscored jobs found',
        scored: 0,
      });
    }

    // Get the user's default resume for candidate matching
    const resume = await db.resume.findFirst({
      where: { userId: session.userId, isDefault: true },
      select: { name: true, fileData: true, skills: true, summary: true, experienceYears: true, targetRole: true },
    });

    // Group jobs by their search criteria
    const jobsBySearch = new Map<string, typeof unscoredJobs>();
    for (const job of unscoredJobs) {
      const searchId = job.jobSearchId;
      if (!jobsBySearch.has(searchId)) {
        jobsBySearch.set(searchId, []);
      }
      jobsBySearch.get(searchId)!.push(job);
    }

    const agentClient = createAgentClient(session.userId);
    let totalScored = 0;

    // Process each search group
    for (const [, jobs] of jobsBySearch) {
      const search = jobs[0].jobSearch;

      // Build resume context - use summary or truncated text, NOT full base64
      let resumeContent: string | null = resume?.summary || null;
      if (!resumeContent && resume?.fileData) {
        try {
          const decoded = Buffer.from(resume.fileData, 'base64').toString('utf-8');
          // Only use first 3000 chars to keep payload small
          resumeContent = decoded.substring(0, 3000);
        } catch {
          resumeContent = null;
        }
      }

      const experienceStr = resume?.experienceYears 
        ? `${resume.experienceYears} years${resume.targetRole ? ` targeting ${resume.targetRole}` : ''}`
        : '';

      try {
        const result = await agentClient.scoreJobs({
          jobs: jobs.map(j => ({
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
      } catch (error) {
        console.error(`Error scoring jobs for search "${search.name}":`, error);
      }
    }

    return NextResponse.json({
      message: `Scored ${totalScored} jobs`,
      scored: totalScored,
      remaining: unscoredJobs.length - totalScored,
    });
  } catch (error) {
    console.error('Job scoring error:', error);
    return NextResponse.json({ error: 'Failed to score jobs' }, { status: 500 });
  }
}
