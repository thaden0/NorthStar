import { NextResponse } from 'next/server';
import { getSession, generateServiceToken } from '@/lib/auth';

const GOOGLE_SERVICE_URL = process.env.GOOGLE_SERVICE_URL || 'http://localhost:3003';

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceToken = await generateServiceToken(session.user.id, session.user.email);

    const response = await fetch(`${GOOGLE_SERVICE_URL}/gmail/unread-count`, {
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ count: 0 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Gmail unread count error:', error);
    return NextResponse.json({ count: 0 });
  }
}
