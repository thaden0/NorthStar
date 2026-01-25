import { NextResponse } from 'next/server';
import { getSession, generateServiceToken } from '@/lib/auth';

const GOOGLE_SERVICE_URL = process.env.GOOGLE_SERVICE_URL || 'http://localhost:3003';

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a service token for the Google Service
    const serviceToken = await generateServiceToken(session.user.id, session.user.email);

    // Call Google Service to check connection status
    const response = await fetch(`${GOOGLE_SERVICE_URL}/oauth/status`, {
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
      },
    });

    if (!response.ok) {
      // If service is unavailable, return not connected
      return NextResponse.json({ connected: false });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Google status error:', error);
    // Return not connected if service is unreachable
    return NextResponse.json({ connected: false });
  }
}
