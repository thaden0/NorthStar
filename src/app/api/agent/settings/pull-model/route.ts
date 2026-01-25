import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { createAgentClient } from '@/lib/agent-service';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !isSuperAdmin(session)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Super Admin access required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { model } = body;

    if (!model || typeof model !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Model name is required' },
        { status: 400 }
      );
    }

    // Validate model name format (basic check)
    const modelNamePattern = /^[a-zA-Z0-9_\-.:]+$/;
    if (!modelNamePattern.test(model)) {
      return NextResponse.json(
        { success: false, error: 'Invalid model name format' },
        { status: 400 }
      );
    }

    const client = createAgentClient(session.userId, session.user.email, session.user.name);
    const result = await client.pullModel(model);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to pull model:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to pull model. It may take a while for large models.' },
      { status: 500 }
    );
  }
}
