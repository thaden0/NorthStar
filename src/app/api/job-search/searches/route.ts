import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searches = await db.jobSearch.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { jobs: true } },
      },
    });

    return NextResponse.json(searches);
  } catch (error) {
    console.error('Failed to fetch job searches:', error);
    return NextResponse.json({ error: 'Failed to fetch job searches' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, keywords, locations, remote, salaryMin, salaryMax, salaryPeriod,
            experienceLevel, jobTypes, industry, companySize, excludeKeywords, sources } = body;

    if (!name || !keywords || keywords.length === 0) {
      return NextResponse.json({ error: 'Name and at least one keyword are required' }, { status: 400 });
    }

    const search = await db.jobSearch.create({
      data: {
        userId: session.userId,
        name,
        keywords: keywords || [],
        locations: locations || [],
        remote: remote || 'any',
        salaryMin: salaryMin ? parseInt(salaryMin) : null,
        salaryMax: salaryMax ? parseInt(salaryMax) : null,
        salaryPeriod: salaryPeriod || 'yearly',
        experienceLevel: experienceLevel || null,
        jobTypes: jobTypes || ['fulltime'],
        industry: industry || null,
        companySize: companySize || null,
        excludeKeywords: excludeKeywords || [],
        sources: sources || ['indeed', 'linkedin'],
      },
      include: {
        _count: { select: { jobs: true } },
      },
    });

    return NextResponse.json(search, { status: 201 });
  } catch (error) {
    console.error('Failed to create job search:', error);
    return NextResponse.json({ error: 'Failed to create job search' }, { status: 500 });
  }
}
