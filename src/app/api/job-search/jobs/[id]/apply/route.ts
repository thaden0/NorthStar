import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/job-search/jobs/[id]/apply
 * Get the current application status for a job
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

    const application = await db.jobApplication.findUnique({
      where: { jobId: id },
    });

    if (!application) {
      return NextResponse.json({ error: 'No application found' }, { status: 404 });
    }

    return NextResponse.json({
      ...application,
      steps: JSON.parse(application.steps || '[]'),
    });
  } catch (error) {
    console.error('Get application status error:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

/**
 * POST /api/job-search/jobs/[id]/apply
 * Start an automated job application — returns SSE stream
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

    // Get the job
    const job = await db.job.findFirst({
      where: { id, userId: session.userId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get cover letter
    const coverLetter = await db.coverLetter.findUnique({
      where: { jobId: id },
    });

    // Get default resume
    const resume = await db.resume.findFirst({
      where: { userId: session.userId, isDefault: true },
      select: {
        name: true, skills: true, experienceYears: true,
        summary: true, fileData: true,
      },
    });

    let resumeContent: string | null = resume?.summary || null;
    if (!resumeContent && resume?.fileData) {
      try {
        resumeContent = Buffer.from(resume.fileData, 'base64').toString('utf-8').substring(0, 3000);
      } catch { resumeContent = null; }
    }

    // Get job board credentials if available
    let boardCredentials: { email: string; password: string } | null = null;
    try {
      const sourceUrl = job.sourceUrl?.toLowerCase() || '';
      let board: string | null = null;
      if (sourceUrl.includes('indeed.com') || sourceUrl.includes('indeed.ca')) board = 'indeed';
      else if (sourceUrl.includes('linkedin.com')) board = 'linkedin';
      else if (sourceUrl.includes('glassdoor.com') || sourceUrl.includes('glassdoor.ca')) board = 'glassdoor';
      else if (sourceUrl.includes('ziprecruiter.com')) board = 'ziprecruiter';

      if (board) {
        const cred = await (db as any).jobBoardCredential.findUnique({
          where: { userId_board: { userId: session.userId, board } },
        });
        if (cred) {
          const { decrypt } = await import('@/lib/encryption');
          boardCredentials = { email: cred.email, password: decrypt(cred.passwordEnc) };
        }
      }
    } catch (e) {
      console.error('Failed to load board credentials:', e);
    }

    // Check if application already exists
    const existing = await db.jobApplication.findUnique({ where: { jobId: id } });
    if (existing && ['in_progress', 'submitted'].includes(existing.status)) {
      return NextResponse.json({
        error: existing.status === 'submitted' ? 'Already applied' : 'Application in progress',
      }, { status: 409 });
    }

    // Create or reset application record
    const application = existing
      ? await db.jobApplication.update({
          where: { jobId: id },
          data: {
            status: 'in_progress',
            steps: '[]',
            currentStep: 'Starting application...',
            totalSteps: 0,
            errorMessage: null,
            lastScreenshot: null,
            startedAt: new Date(),
            completedAt: null,
          },
        })
      : await db.jobApplication.create({
          data: {
            userId: session.userId,
            jobId: id,
            status: 'in_progress',
            steps: '[]',
            currentStep: 'Starting application...',
            startedAt: new Date(),
          },
        });

    // Get Agent Service URL
    const agentUrl = process.env.AGENT_SERVICE_URL || 'http://172.17.0.1:3002';
    const { generateServiceToken } = await import('@/lib/auth');
    const token = await generateServiceToken(session.userId, session.user.email);

    // Start SSE stream from Agent Service
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch(`${agentUrl}/job-apply/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              job: {
                id: job.id,
                title: job.title,
                company: job.company,
                sourceUrl: job.sourceUrl,
                description: job.description,
              },
              resume: resume ? {
                name: resume.name,
                skills: resume.skills || [],
                experienceYears: resume.experienceYears,
                summary: resume.summary,
                content: resumeContent,
                fileData: resume.fileData,
              } : null,
              coverLetter: coverLetter ? { content: coverLetter.content } : null,
              userInfo: {
                name: session.user.name || 'User',
                email: session.user.email,
              },
              boardCredentials: boardCredentials || undefined,
            }),
          });

          if (!response.ok || !response.body) {
            const errText = await response.text();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errText })}\n\n`));
            controller.close();
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          const allSteps: unknown[] = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE events
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.substring(6);
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));

                // Parse and save steps
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === 'step') {
                    allSteps.push(parsed.step);
                    // Update DB with latest step
                    await db.jobApplication.update({
                      where: { id: application.id },
                      data: {
                        steps: JSON.stringify(allSteps),
                        currentStep: parsed.step.description,
                        totalSteps: allSteps.length,
                        lastScreenshot: parsed.step.screenshot || undefined,
                      },
                    });
                  } else if (parsed.type === 'complete') {
                    // Update final status
                    const status = parsed.result?.status || 'failed';
                    await db.jobApplication.update({
                      where: { id: application.id },
                      data: {
                        status,
                        steps: JSON.stringify(allSteps),
                        totalSteps: allSteps.length,
                        completedAt: new Date(),
                        lastScreenshot: parsed.result?.lastScreenshot || undefined,
                        errorMessage: parsed.result?.errorMessage || null,
                      },
                    });

                    // If submitted, update job status
                    if (status === 'submitted') {
                      await db.job.update({
                        where: { id: job.id },
                        data: { status: 'applied', appliedAt: new Date() },
                      });
                    }
                  }
                } catch { /* ignore parse errors */ }
              }
            }
          }
        } catch (error) {
          console.error('SSE stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`));

          // Update application as failed
          await db.jobApplication.update({
            where: { id: application.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              errorMessage: String(error),
            },
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Start application error:', error);
    return NextResponse.json({ error: 'Failed to start application' }, { status: 500 });
  }
}
