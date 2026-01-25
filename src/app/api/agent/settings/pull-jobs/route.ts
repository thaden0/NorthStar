import { NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { createAgentClient } from '@/lib/agent-service';

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session || !isSuperAdmin(session)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Super Admin access required' },
        { status: 401 }
      );
    }

    const client = createAgentClient(session.userId, session.user.email, session.user.name);
    const jobs = await client.getActivePullJobs();
    
    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    console.error('Failed to get pull jobs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get pull jobs' },
      { status: 500 }
    );
  }
}
