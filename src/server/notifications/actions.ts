'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// ==================== NOTIFICATIONS ====================

export async function getNotifications(limit = 20) {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  return prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getUnreadNotificationCount() {
  const session = await getSession();
  if (!session?.user?.id) {
    return 0;
  }

  return prisma.notification.count({
    where: { 
      userId: session.user.id,
      read: false,
    },
  });
}

export async function markNotificationAsRead(id: string) {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  await prisma.notification.update({
    where: { id, userId: session.user.id },
    data: { read: true },
  });

  revalidatePath('/dashboard');
}

export async function markAllNotificationsAsRead() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  revalidatePath('/dashboard');
}

export async function deleteNotification(id: string) {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  await prisma.notification.delete({
    where: { id, userId: session.user.id },
  });

  revalidatePath('/dashboard');
}

// ==================== SCHEDULED TASKS ====================

export type ScheduleType = 'cron' | 'once' | 'recurring';
export type RecurringPattern = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'weekdays' | 'weekends';

export interface CreateScheduledTaskInput {
  name: string;
  description?: string;
  prompt: string;
  scheduleType: ScheduleType;
  cronExpression?: string;
  scheduledAt?: string;
  recurringPattern?: RecurringPattern;
  recurringDay?: number;
  recurringTime?: string;
  timezone?: string;
  enabled?: boolean;
}

export async function getScheduledTasks() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  return prisma.scheduledTask.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getScheduledTask(id: string) {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const task = await prisma.scheduledTask.findUnique({
    where: { id },
  });

  if (!task || task.userId !== session.user.id) {
    throw new Error('Task not found');
  }

  return task;
}

export async function createScheduledTask(input: CreateScheduledTaskInput) {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const nextRunAt = calculateNextRun(input);

  const task = await prisma.scheduledTask.create({
    data: {
      userId: session.user.id,
      name: input.name,
      description: input.description,
      prompt: input.prompt,
      scheduleType: input.scheduleType,
      cronExpression: input.cronExpression,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      recurringPattern: input.recurringPattern,
      recurringDay: input.recurringDay,
      recurringTime: input.recurringTime,
      timezone: input.timezone || 'UTC',
      enabled: input.enabled ?? true,
      nextRunAt,
    },
  });

  // Sync to Agent Service
  await syncTaskToAgentService(task, 'create');

  revalidatePath('/dashboard/settings/scheduled-tasks');
  return task;
}

export async function updateScheduledTask(id: string, input: Partial<CreateScheduledTaskInput>) {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const existing = await prisma.scheduledTask.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    throw new Error('Task not found');
  }

  const mergedInput = {
    ...existing,
    ...input,
  };

  const nextRunAt = calculateNextRun(mergedInput as CreateScheduledTaskInput);

  const task = await prisma.scheduledTask.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      prompt: input.prompt,
      scheduleType: input.scheduleType,
      cronExpression: input.cronExpression,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      recurringPattern: input.recurringPattern,
      recurringDay: input.recurringDay,
      recurringTime: input.recurringTime,
      timezone: input.timezone,
      enabled: input.enabled,
      nextRunAt,
    },
  });

  // Sync to Agent Service
  await syncTaskToAgentService(task, 'update');

  revalidatePath('/dashboard/settings/scheduled-tasks');
  return task;
}

export async function deleteScheduledTask(id: string) {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const task = await prisma.scheduledTask.findUnique({ where: { id } });
  if (!task || task.userId !== session.user.id) {
    throw new Error('Task not found');
  }

  await prisma.scheduledTask.delete({ where: { id } });

  // Sync to Agent Service
  await syncTaskToAgentService(task, 'delete');

  revalidatePath('/dashboard/settings/scheduled-tasks');
}

export async function toggleScheduledTask(id: string, enabled: boolean) {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const task = await prisma.scheduledTask.update({
    where: { id, userId: session.user.id },
    data: { enabled },
  });

  // Sync to Agent Service
  await syncTaskToAgentService(task, 'update');

  revalidatePath('/dashboard/settings/scheduled-tasks');
  return task;
}

export async function triggerScheduledTask(id: string) {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const task = await prisma.scheduledTask.findUnique({ where: { id } });
  if (!task || task.userId !== session.user.id) {
    throw new Error('Task not found');
  }

  // Call Agent Service to trigger the job
  const agentServiceUrl = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';
  
  try {
    const response = await fetch(`${agentServiceUrl}/cron-jobs/${id}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to trigger task');
    }

    return { success: true };
  } catch (error) {
    console.error('Error triggering task:', error);
    throw new Error('Failed to trigger task');
  }
}

// ==================== HELPERS ====================

function calculateNextRun(input: CreateScheduledTaskInput): Date | null {
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
