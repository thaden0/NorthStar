import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// Helper to calculate next run time
function calculateNextRun(input: {
  scheduleType: string;
  scheduledAt?: string | null;
  cronExpression?: string | null;
  recurringPattern?: string | null;
  recurringDay?: number | null;
  recurringTime?: string | null;
}): Date | null {
  const now = new Date();

  switch (input.scheduleType) {
    case 'once':
      if (input.scheduledAt) {
        const scheduled = new Date(input.scheduledAt);
        return scheduled > now ? scheduled : null;
      }
      return null;

    case 'cron':
      if (input.cronExpression) {
        return getNextCronTime(input.cronExpression);
      }
      return null;

    case 'recurring':
      return getNextRecurringTime(
        input.recurringPattern || 'daily',
        input.recurringDay,
        input.recurringTime || '09:00'
      );

    default:
      return null;
  }
}

function getNextCronTime(expression: string): Date {
  const parts = expression.split(' ');
  if (parts.length !== 5) {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  const [minute, hour, , , dayOfWeek] = parts;
  const now = new Date();
  const next = new Date(now);

  if (hour !== '*') next.setHours(parseInt(hour, 10));
  if (minute !== '*') next.setMinutes(parseInt(minute, 10));
  next.setSeconds(0);
  next.setMilliseconds(0);

  if (next <= now) {
    if (dayOfWeek !== '*') {
      const targetDay = parseInt(dayOfWeek, 10);
      const currentDay = now.getDay();
      const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
      next.setDate(next.getDate() + daysUntil);
    } else {
      next.setDate(next.getDate() + 1);
    }
  }

  return next;
}

function getNextRecurringTime(
  pattern: string,
  day: number | undefined | null,
  time: string
): Date {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date(now);

  next.setHours(hours, minutes, 0, 0);

  switch (pattern) {
    case 'daily':
      if (next <= now) next.setDate(next.getDate() + 1);
      break;

    case 'weekly': {
      const targetDay = day ?? 1;
      const currentDay = now.getDay();
      let daysUntil = (targetDay - currentDay + 7) % 7;
      if (daysUntil === 0 && next <= now) daysUntil = 7;
      next.setDate(next.getDate() + daysUntil);
      break;
    }

    case 'biweekly': {
      const biweeklyDay = day ?? 1;
      const biweeklyCurrent = now.getDay();
      let biweeklyDays = (biweeklyDay - biweeklyCurrent + 7) % 7;
      if (biweeklyDays === 0 && next <= now) biweeklyDays = 14;
      else if (biweeklyDays <= 7) biweeklyDays += 7;
      next.setDate(next.getDate() + biweeklyDays);
      break;
    }

    case 'monthly': {
      const targetDate = day ?? 1;
      next.setDate(targetDate);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      break;
    }

    case 'weekdays':
      if (next <= now) next.setDate(next.getDate() + 1);
      while (next.getDay() === 0 || next.getDay() === 6) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case 'weekends':
      if (next <= now) next.setDate(next.getDate() + 1);
      while (next.getDay() !== 0 && next.getDay() !== 6) {
        next.setDate(next.getDate() + 1);
      }
      break;
  }

  return next;
}

// Sync to Agent Service
async function syncTaskToAgentService(
  task: {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    prompt: string;
    scheduleType: string;
    cronExpression: string | null;
    scheduledAt: Date | null;
    recurringPattern: string | null;
    recurringDay: number | null;
    recurringTime: string | null;
    timezone: string;
    enabled: boolean;
  },
  action: 'create' | 'update' | 'delete'
) {
  const agentServiceUrl = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';

  try {
    if (action === 'delete') {
      await fetch(`${agentServiceUrl}/cron-jobs/${task.id}`, {
        method: 'DELETE',
      });
    } else {
      const method = action === 'create' ? 'POST' : 'PUT';
      const url = action === 'create' 
        ? `${agentServiceUrl}/cron-jobs`
        : `${agentServiceUrl}/cron-jobs/${task.id}`;

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: task.userId,
          name: task.name,
          description: task.description,
          prompt: task.prompt,
          scheduleType: task.scheduleType,
          cronExpression: task.cronExpression,
          scheduledAt: task.scheduledAt?.toISOString(),
          recurringPattern: task.recurringPattern,
          recurringDay: task.recurringDay,
          recurringTime: task.recurringTime,
          timezone: task.timezone,
          enabled: task.enabled,
        }),
      });
    }
  } catch (error) {
    console.error('Error syncing task to Agent Service:', error);
    // Don't throw - we still want to save locally even if sync fails
  }
}

// GET /api/scheduled-tasks - List all scheduled tasks
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const userId = request.headers.get('X-User-Id') || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tasks = await prisma.scheduledTask.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Error fetching scheduled tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch scheduled tasks' }, { status: 500 });
  }
}

// POST /api/scheduled-tasks - Create a new scheduled task
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const userId = request.headers.get('X-User-Id') || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      prompt,
      scheduleType,
      cronExpression,
      scheduledAt,
      recurringPattern,
      recurringDay,
      recurringTime,
      timezone,
      enabled,
    } = body;

    if (!name || !prompt || !scheduleType) {
      return NextResponse.json({ error: 'Missing required fields: name, prompt, scheduleType' }, { status: 400 });
    }

    const nextRunAt = calculateNextRun({
      scheduleType,
      scheduledAt,
      cronExpression,
      recurringPattern,
      recurringDay,
      recurringTime,
    });

    const task = await prisma.scheduledTask.create({
      data: {
        userId,
        name,
        description: description || null,
        prompt,
        scheduleType,
        cronExpression: cronExpression || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        recurringPattern: recurringPattern || null,
        recurringDay: recurringDay ?? null,
        recurringTime: recurringTime || null,
        timezone: timezone || 'America/New_York',
        enabled: enabled ?? true,
        nextRunAt,
      },
    });

    // Sync to Agent Service
    await syncTaskToAgentService(task, 'create');

    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (error) {
    console.error('Error creating scheduled task:', error);
    return NextResponse.json({ error: 'Failed to create scheduled task' }, { status: 500 });
  }
}
