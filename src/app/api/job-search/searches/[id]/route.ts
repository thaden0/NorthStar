import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await db.jobSearch.findFirst({
      where: { id, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Job search not found' }, { status: 404 });
    }

    const updated = await db.jobSearch.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        keywords: body.keywords ?? existing.keywords,
        locations: body.locations !== undefined ? body.locations : existing.locations,
        remote: body.remote ?? existing.remote,
        salaryMin: body.salaryMin !== undefined ? (body.salaryMin ? parseInt(body.salaryMin) : null) : existing.salaryMin,
        salaryMax: body.salaryMax !== undefined ? (body.salaryMax ? parseInt(body.salaryMax) : null) : existing.salaryMax,
        salaryPeriod: body.salaryPeriod ?? existing.salaryPeriod,
        experienceLevel: body.experienceLevel !== undefined ? body.experienceLevel : existing.experienceLevel,
        jobTypes: body.jobTypes ?? existing.jobTypes,
        industry: body.industry !== undefined ? body.industry : existing.industry,
        companySize: body.companySize !== undefined ? body.companySize : existing.companySize,
        excludeKeywords: body.excludeKeywords ?? existing.excludeKeywords,
        sources: body.sources ?? existing.sources,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
      },
      include: {
        _count: { select: { jobs: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update job search:', error);
    return NextResponse.json({ error: 'Failed to update job search' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await db.jobSearch.findFirst({
      where: { id, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Job search not found' }, { status: 404 });
    }

    await db.jobSearch.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete job search:', error);
    return NextResponse.json({ error: 'Failed to delete job search' }, { status: 500 });
  }
}
