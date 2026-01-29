import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/files/[id] - Get a single file
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getSession();
    const userId = request.headers.get('X-User-Id') || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const file = await prisma.file.findFirst({
      where: { id, uploadedBy: userId },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: file });
  } catch (error) {
    console.error('Error fetching file:', error);
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
  }
}

// PATCH /api/files/[id] - Update a file record
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getSession();
    const userId = request.headers.get('X-User-Id') || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership
    const existing = await prisma.file.findFirst({ where: { id, uploadedBy: userId } });
    if (!existing) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name } = body;

    const file = await prisma.file.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
      },
    });

    return NextResponse.json({ success: true, data: file });
  } catch (error) {
    console.error('Error updating file:', error);
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
  }
}

// DELETE /api/files/[id] - Delete a file record
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getSession();
    const userId = request.headers.get('X-User-Id') || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership
    const existing = await prisma.file.findFirst({ where: { id, uploadedBy: userId } });
    if (!existing) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // TODO: Also delete from storage (S3, etc.) if needed
    await prisma.file.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
