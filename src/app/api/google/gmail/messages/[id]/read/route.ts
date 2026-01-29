import { NextRequest, NextResponse } from 'next/server';
import { getSession, generateServiceToken } from '@/lib/auth';

const GOOGLE_SERVICE_URL = process.env.GOOGLE_SERVICE_URL || 'http://localhost:3003';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const serviceToken = await generateServiceToken(session.user.id, session.user.email);

    const response = await fetch(`${GOOGLE_SERVICE_URL}/gmail/messages/${id}/read`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to mark as read' }));
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Gmail mark read error:', error);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}
