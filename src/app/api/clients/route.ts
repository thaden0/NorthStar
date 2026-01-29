import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET /api/clients - List all clients for the user
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const userId = request.headers.get('X-User-Id') || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clients = await prisma.client.findMany({
      where: { userId },
      include: {
        projects: true,
        _count: {
          select: { timeEntries: true }
        }
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

// POST /api/clients - Create a new client
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const userId = request.headers.get('X-User-Id') || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, phone, address, notes, hourlyRate, color, isActive } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const client = await prisma.client.create({
      data: {
        userId,
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
        hourlyRate: hourlyRate ?? 0,
        color: color || '#3b82f6',
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ success: true, data: client }, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}
