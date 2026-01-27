import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Internal endpoint for Agent Service to create notifications
 * Protected by internal API secret
 */
export async function POST(request: NextRequest) {
  // Verify internal API secret
  const internalSecret = request.headers.get('X-Internal-Secret');
  const expectedSecret = process.env.INTERNAL_API_SECRET || 'internal-secret';

  if (internalSecret !== expectedSecret) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    
    const { userId, type, title, message, data } = body;

    if (!userId || !type || !title || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data || {},
      },
    });

    return NextResponse.json({ success: true, data: notification });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}
