import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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
  }
}

// GET /api/scheduled-tasks/[id] - Get a single task
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getSession();
    const userId = request.headers.get('X-User-Id') || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const task = await prisma.scheduledTask.findFirst({
      where: { id, userId },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

// PATCH /api/scheduled-tasks/[id] - Update a task
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getSession();
    const userId = request.headers.get('X-User-Id') || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.scheduledTask.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
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

    // Merge with existing for next run calculation
    const mergedInput = {
      scheduleType: scheduleType ?? existing.scheduleType,
      scheduledAt: scheduledAt ?? existing.scheduledAt?.toISOString(),
      cronExpression: cronExpression ?? existing.cronExpression,
      recurringPattern: recurringPattern ?? existing.recurringPattern,
      recurringDay: recurringDay ?? existing.recurringDay,
      recurringTime: recurringTime ?? existing.recurringTime,
    };

    const nextRunAt = calculateNextRun(mergedInput);

    const task = await prisma.scheduledTask.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(prompt !== undefined && { prompt }),
        ...(scheduleType !== undefined && { scheduleType }),
        ...(cronExpression !== undefined && { cronExpression }),
        ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }),
        ...(recurringPattern !== undefined && { recurringPattern }),
        ...(recurringDay !== undefined && { recurringDay }),
        ...(recurringTime !== undefined && { recurringTime }),
        ...(timezone !== undefined && { timezone }),
        ...(enabled !== undefined && { enabled }),
        nextRunAt,
      },
    });

    // Sync to Agent Service
    await syncTaskToAgentService(task, 'update');

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE /api/scheduled-tasks/[id] - Delete a task
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getSession();
    const userId = request.headers.get('X-User-Id') || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.scheduledTask.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    await prisma.scheduledTask.delete({ where: { id } });

    // Sync to Agent Service
    await syncTaskToAgentService(existing, 'delete');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
