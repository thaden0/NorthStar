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

    const existing = await db.job.findFirst({
      where: { id, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const updated = await db.job.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        isFavorite: body.isFavorite !== undefined ? body.isFavorite : existing.isFavorite,
        resumeId: body.resumeId !== undefined ? body.resumeId : existing.resumeId,
        appliedAt: body.status === 'applied' && existing.status !== 'applied' ? new Date() : existing.appliedAt,
        autoApply: body.autoApply !== undefined ? body.autoApply : existing.autoApply,
      },
      include: {
        jobSearch: { select: { name: true } },
        resume: { select: { name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update job:', error);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
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

    const existing = await db.job.findFirst({
      where: { id, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    await db.job.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete job:', error);
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
  }
}
