import { NextResponse } from 'next/server';
import { getSession, generateServiceToken } from '@/lib/auth';

const GOOGLE_SERVICE_URL = process.env.GOOGLE_SERVICE_URL || 'http://localhost:3003';

export async function DELETE() {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a service token for the Google Service
    const serviceToken = await generateServiceToken(session.user.id, session.user.email);

    // Call Google Service to disconnect
    const response = await fetch(`${GOOGLE_SERVICE_URL}/oauth/disconnect`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
      },
    });

    if (!response.ok) {
      await response.text();
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Google disconnect error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
