import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'log';
  service: string;
  context?: string;
  message: string;
  raw: string;
}

// Parse NestJS log format: [Nest] 1  - 01/27/2026, 3:12:41 PM     LOG [Context] Message
const parseNestLog = (line: string, service: string): LogEntry | null => {
  const nestMatch = line.match(
    /\[Nest\]\s*\d+\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4},\s*\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?)\s*(LOG|ERROR|WARN|DEBUG|VERBOSE)\s*(?:\[([^\]]+)\])?\s*(.*)/i
  );
  
  if (nestMatch) {
    const [, timestamp, level, context, message] = nestMatch;
    return {
      id: `${service}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(timestamp).toISOString(),
      level: level.toLowerCase() as LogEntry['level'],
      service,
      context: context || undefined,
      message: message.trim(),
      raw: line,
    };
  }
  
  return null;
};

// Parse Next.js/general log format
const parseGeneralLog = (line: string, service: string): LogEntry | null => {
  // Skip empty lines
  if (!line.trim()) return null;
  
  // Try to detect log level from common patterns
  let level: LogEntry['level'] = 'info';
  if (/error|exception|failed|fatal/i.test(line)) level = 'error';
  else if (/warn|warning/i.test(line)) level = 'warn';
  else if (/debug/i.test(line)) level = 'debug';
  
  // Try to extract timestamp from various formats
  let timestamp = new Date().toISOString();
  const isoMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  if (isoMatch) {
    timestamp = new Date(isoMatch[1]).toISOString();
  }
  
  return {
    id: `${service}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp,
    level,
    service,
    message: line.trim(),
    raw: line,
  };
};

const parseLogs = (output: string, service: string): LogEntry[] => {
  const lines = output.split('\n').filter(line => line.trim());
  const logs: LogEntry[] = [];
  
  for (const line of lines) {
    // Try NestJS format first (for Agent Service)
    let entry = parseNestLog(line, service);
    
    // Fall back to general parsing
    if (!entry) {
      entry = parseGeneralLog(line, service);
    }
    
    if (entry) {
      logs.push(entry);
    }
  }
  
  return logs;
};

async function fetchDockerLogs(containerName: string, tailCount: number): Promise<string> {
  // Since we're running inside Docker, we need to use the Docker API
  // or exec into the host. For now, we'll use the /var/run/docker.sock if available
  // Otherwise, we'll return sample data for development
  
  try {
    // Try to fetch from Docker socket (works when running in Docker with socket mounted)
    const dockerHost = process.env.DOCKER_HOST || 'unix:///var/run/docker.sock';
    
    if (dockerHost.startsWith('unix://')) {
      // Use unix socket - this requires the socket to be mounted in the container
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        const { stdout } = await execAsync(
          `docker logs --tail ${tailCount} ${containerName} 2>&1`,
          { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
        );
        return stdout;
      } catch (err) {
        // Docker command failed - likely not available from inside container
        console.log(`Docker logs not available for ${containerName}: ${err}`);
        return '';
      }
    }
    
    return '';
  } catch (err) {
    console.error('Error fetching Docker logs:', err);
    return '';
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const searchParams = request.nextUrl.searchParams;
  const count = parseInt(searchParams.get('count') || '200', 10);
  const service = searchParams.get('service') || 'all';
  
  const allLogs: LogEntry[] = [];
  
  try {
    // Fetch logs based on service filter
    if (service === 'all' || service === 'northstar') {
      const northstarLogs = await fetchDockerLogs('northstar-app-1', count);
      if (northstarLogs) {
        allLogs.push(...parseLogs(northstarLogs, 'northstar'));
      }
    }
    
    if (service === 'all' || service === 'agent') {
      const agentLogs = await fetchDockerLogs('agentservice-agent-service-1', count);
      if (agentLogs) {
        allLogs.push(...parseLogs(agentLogs, 'agent-service'));
      }
    }
    
    // Sort by timestamp (newest first)
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Limit to requested count
    const limitedLogs = allLogs.slice(0, count);
    
    return NextResponse.json({
      success: true,
      logs: limitedLogs,
      total: allLogs.length,
    });
  } catch (error) {
    console.error('Error in logs API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs', details: String(error) },
      { status: 500 }
    );
  }
}
