import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { createAgentClient } from '@/lib/agent-service';

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !isSuperAdmin(session)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
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

    const client = createAgentClient(session.userId, session.user.email, session.user.name);
    await client.setDefaultModel(model);

    return NextResponse.json({ success: true, model });
  } catch (error) {
    console.error('Failed to update default model:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update default model' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const client = createAgentClient(session.userId);
    const model = await client.getDefaultModel();

    return NextResponse.json({ success: true, model });
  } catch (error) {
    console.error('Failed to get default model:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get default model' },
      { status: 500 }
    );
  }
}
