import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { generateClientToken } from '@/lib/agent-service';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { conversationId } = await params;

    if (!conversationId) {
      return new Response('Conversation ID is required', { status: 400 });
    }

    // Generate a token for the Agent Service
    const token = await generateClientToken(user.id, user.email, user.name);

    // Connect to the Agent Service SSE endpoint
    const agentStreamUrl = `${AGENT_SERVICE_URL}/chat/${conversationId}/stream?token=${encodeURIComponent(token)}`;

    const agentResponse = await fetch(agentStreamUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
    });

    if (!agentResponse.ok) {
      return new Response(`Agent service error: ${agentResponse.statusText}`, { 
        status: agentResponse.status 
      });
    }

    // Create a TransformStream to proxy the SSE
    const { readable, writable } = new TransformStream();
    
    // Pipe the agent response to our response
    const reader = agentResponse.body?.getReader();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    if (reader) {
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              await writer.close();
              break;
            }
            // Forward the SSE data
            await writer.write(value);
          }
        } catch (error) {
          console.error('SSE proxy error:', error);
          try {
            // Send error event to client
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Stream interrupted' })}\n\n`));
            await writer.close();
          } catch {
            // Ignore close errors
          }
        }
      })();
    }

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('SSE proxy setup error:', error);
    return new Response('Failed to setup SSE stream', { status: 500 });
  }
}
