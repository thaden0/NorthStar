import { NextRequest, NextResponse } from 'next/server';
import { getSession, generateServiceToken } from '@/lib/auth';

const GOOGLE_SERVICE_URL = process.env.GOOGLE_SERVICE_URL || 'http://localhost:3003';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceToken = await generateServiceToken(session.user.id, session.user.email);
    
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || 'in:inbox';
    const maxResults = searchParams.get('maxResults') || '50';
    const pageToken = searchParams.get('pageToken') || '';

    const url = new URL(`${GOOGLE_SERVICE_URL}/gmail/messages`);
    url.searchParams.set('query', query);
    url.searchParams.set('maxResults', maxResults);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch emails' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Gmail messages error:', error);
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceToken = await generateServiceToken(session.user.id, session.user.email);
    const body = await request.json();

    const response = await fetch(`${GOOGLE_SERVICE_URL}/gmail/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to send email' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Gmail send error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
