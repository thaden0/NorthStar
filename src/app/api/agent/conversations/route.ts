import { NextResponse } from 'next/server';
import { createAgentClient } from '@/lib/agent-service';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = createAgentClient(user.id, user.email, user.name);
    const conversations = await client.getConversations();

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get conversations' },
      { status: 500 }
    );
  }
}
