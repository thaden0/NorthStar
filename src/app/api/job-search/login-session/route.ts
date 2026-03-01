import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const AGENT_URL = process.env.AGENT_SERVICE_URL || 'http://172.17.0.1:3002';

async function proxyToAgent(endpoint: string, body: Record<string, unknown>) {
  const { generateServiceToken } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = await generateServiceToken(session.userId, session.user.email);
  
  const res = await fetch(`${AGENT_URL}/job-apply/login/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data);
}

// POST — handles all login actions
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, ...rest } = body;

  // Inject userId from session
  const userId = session.user.email.replace(/[^a-zA-Z0-9]/g, '_');

  switch (action) {
    case 'start':
      return proxyToAgent('start', { userId, board: rest.board });
    case 'screenshot':
      return proxyToAgent('screenshot', { sessionId: `${userId}:${rest.board}` });
    case 'click':
      return proxyToAgent('click', { sessionId: `${userId}:${rest.board}`, x: rest.x, y: rest.y });
    case 'navigate':
      return proxyToAgent('navigate', { sessionId: `${userId}:${rest.board}`, url: rest.url });
    case 'type':
      return proxyToAgent('type', { sessionId: `${userId}:${rest.board}`, text: rest.text });
    case 'keypress':
      return proxyToAgent('keypress', { sessionId: `${userId}:${rest.board}`, key: rest.key });
    case 'clear':
      return proxyToAgent('clear', { sessionId: `${userId}:${rest.board}` });
    case 'end':
      return proxyToAgent('end', { sessionId: `${userId}:${rest.board}` });
    case 'delete':
      return proxyToAgent('delete', { userId, board: rest.board });
    case 'check':
      return proxyToAgent('check', { userId, board: rest.board });
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}

// GET — list profiles
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.email.replace(/[^a-zA-Z0-9]/g, '_');
  const { generateServiceToken } = await import('@/lib/auth');
  const token = await generateServiceToken(session.userId, session.user.email);

  const res = await fetch(`${AGENT_URL}/job-apply/login/profiles/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  return NextResponse.json(data);
}
