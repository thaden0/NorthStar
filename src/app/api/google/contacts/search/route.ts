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
    const query = searchParams.get('q') || '';

    if (!query) {
      return NextResponse.json({ error: 'Search query required' }, { status: 400 });
    }

    const url = new URL(`${GOOGLE_SERVICE_URL}/contacts/search`);
    url.searchParams.set('q', query);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to search contacts' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Contacts search error:', error);
    return NextResponse.json({ error: 'Failed to search contacts' }, { status: 500 });
  }
}
