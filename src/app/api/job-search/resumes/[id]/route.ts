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

    const existing = await db.resume.findFirst({
      where: { id, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    // If setting as default, unset others
    if (body.isDefault === true) {
      await db.resume.updateMany({
        where: { userId: session.userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await db.resume.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        targetRole: body.targetRole !== undefined ? body.targetRole : existing.targetRole,
        targetIndustry: body.targetIndustry !== undefined ? body.targetIndustry : existing.targetIndustry,
        skills: body.skills ?? existing.skills,
        experienceYears: body.experienceYears !== undefined ? body.experienceYears : existing.experienceYears,
        summary: body.summary !== undefined ? body.summary : existing.summary,
        isDefault: body.isDefault !== undefined ? body.isDefault : existing.isDefault,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
      },
      select: {
        id: true,
        userId: true,
        name: true,
        fileName: true,
        fileUrl: true,
        fileSize: true,
        fileType: true,
        targetRole: true,
        targetIndustry: true,
        skills: true,
        experienceYears: true,
        summary: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update resume:', error);
    return NextResponse.json({ error: 'Failed to update resume' }, { status: 500 });
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

    const existing = await db.resume.findFirst({
      where: { id, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    await db.resume.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete resume:', error);
    return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 });
  }
}
