import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const searchId = searchParams.get('searchId');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortDir = searchParams.get('sortDir') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search');
    const favorite = searchParams.get('favorite');
    const minScore = searchParams.get('minScore');

    // Build where clause
    const where: Record<string, unknown> = { userId: session.userId };
    if (status && status !== 'all') where.status = status;
    if (source && source !== 'all') where.source = source;
    if (searchId && searchId !== 'all') where.jobSearchId = searchId;
    if (favorite === 'true') where.isFavorite = true;
    if (minScore) where.aiScore = { gte: parseFloat(minScore) };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [jobs, total] = await Promise.all([
      db.job.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        take: limit,
        skip: (page - 1) * limit,
        include: {
          jobSearch: { select: { name: true } },
          resume: { select: { name: true } },
        },
      }),
      db.job.count({ where }),
    ]);

    // Get status counts
    const statusCounts = await db.job.groupBy({
      by: ['status'],
      where: { userId: session.userId },
      _count: { status: true },
    });

    return NextResponse.json({
      jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      statusCounts: statusCounts.reduce((acc, s) => {
        acc[s.status] = s._count.status;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
