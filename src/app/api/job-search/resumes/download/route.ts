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
    const resumeId = searchParams.get('id');

    if (!resumeId) {
      return NextResponse.json({ error: 'Resume ID required' }, { status: 400 });
    }

    const resume = await db.resume.findFirst({
      where: { id: resumeId, userId: session.userId },
      select: {
        fileName: true,
        fileType: true,
        fileData: true,
      },
    });

    if (!resume || !resume.fileData) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    const buffer = Buffer.from(resume.fileData, 'base64');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': resume.fileType,
        'Content-Disposition': `attachment; filename="${resume.fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Failed to download resume:', error);
    return NextResponse.json({ error: 'Failed to download resume' }, { status: 500 });
  }
}
