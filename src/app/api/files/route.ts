import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET /api/files - List all files
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const userId = request.headers.get('X-User-Id') || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const files = await prisma.file.findMany({
      where: {
        uploadedBy: userId,
        ...(type && { type: { contains: type } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ success: true, data: files });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}

// POST /api/files - Create a new file record
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const userId = request.headers.get('X-User-Id') || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, key, url, size, type } = body;

    if (!name || !key || !url || size === undefined || !type) {
      return NextResponse.json({ error: 'Missing required fields: name, key, url, size, type' }, { status: 400 });
    }

    const file = await prisma.file.create({
      data: {
        name,
        key,
        url,
        size,
        type,
        uploadedBy: userId,
      },
    });

    return NextResponse.json({ success: true, data: file }, { status: 201 });
  } catch (error) {
    console.error('Error creating file:', error);
    return NextResponse.json({ error: 'Failed to create file' }, { status: 500 });
  }
}
