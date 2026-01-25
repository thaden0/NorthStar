import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { createAgentClient } from '@/lib/agent-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session || !isSuperAdmin(session)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Super Admin access required' },
        { status: 401 }
      );
    }

    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const client = createAgentClient(session.userId, session.user.email, session.user.name);
    const result = await client.getPullJobStatus(jobId);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to get pull status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get pull status' },
      { status: 500 }
    );
  }
}
