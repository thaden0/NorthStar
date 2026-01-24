import { NextRequest, NextResponse } from 'next/server';
import { createAgentClient, generateClientToken, getAgentServiceUrl } from '@/lib/agent-service';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, conversationId } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const client = createAgentClient(user.id, user.email, user.name);
    
    // Sync user to Agent Service (creates if not exists)
    try {
      await client.syncUser();
    } catch (err) {
      console.warn('Failed to sync user to Agent Service:', err);
    }

    const response = await client.chat(prompt, conversationId);

    // Generate a client token for SSE streaming
    const clientToken = await generateClientToken(user.id, user.email, user.name);

    return NextResponse.json({
      ...response,
      clientToken,
      agentServiceUrl: getAgentServiceUrl(),
    });
  } catch (error) {
    console.error('Agent chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start chat' },
      { status: 500 }
    );
  }
}
