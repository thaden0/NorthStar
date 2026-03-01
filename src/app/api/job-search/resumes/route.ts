import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resumes = await db.resume.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
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

    return NextResponse.json(resumes);
  } catch (error) {
    console.error('Failed to fetch resumes:', error);
    return NextResponse.json({ error: 'Failed to fetch resumes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string;
    const targetRole = formData.get('targetRole') as string | null;
    const targetIndustry = formData.get('targetIndustry') as string | null;
    const skills = formData.get('skills') as string | null;
    const experienceYears = formData.get('experienceYears') as string | null;
    const summary = formData.get('summary') as string | null;
    const isDefault = formData.get('isDefault') === 'true';

    if (!file || !name) {
      return NextResponse.json({ error: 'File and name are required' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only PDF and Word documents are supported' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    // Convert file to base64 for database storage
    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString('base64');

    // If setting as default, unset others
    if (isDefault) {
      await db.resume.updateMany({
        where: { userId: session.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const resume = await db.resume.create({
      data: {
        userId: session.userId,
        name,
        fileName: file.name,
        fileUrl: `/api/job-search/resumes/download`,
        fileSize: file.size,
        fileType: file.type,
        fileData: base64Data,
        targetRole: targetRole || null,
        targetIndustry: targetIndustry || null,
        skills: skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [],
        experienceYears: experienceYears ? parseInt(experienceYears) : null,
        summary: summary || null,
        isDefault,
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

    return NextResponse.json(resume, { status: 201 });
  } catch (error) {
    console.error('Failed to upload resume:', error);
    return NextResponse.json({ error: 'Failed to upload resume' }, { status: 500 });
  }
}
