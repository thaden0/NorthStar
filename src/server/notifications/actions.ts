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

export interface ScheduledTaskWithSource {
  id: string;
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
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  runCount: number;
  createdAt: Date;
  source: 'local' | 'agent';
}

export async function getScheduledTasks(): Promise<ScheduledTaskWithSource[]> {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  // Fetch from local database
  const localTasks = await prisma.scheduledTask.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  // Convert local tasks to common format
  const localTasksWithSource: ScheduledTaskWithSource[] = localTasks.map(task => ({
    id: task.id,
    name: task.name,
    description: task.description,
    prompt: task.prompt,
    scheduleType: task.scheduleType,
    cronExpression: task.cronExpression,
    scheduledAt: task.scheduledAt,
    recurringPattern: task.recurringPattern,
    recurringDay: task.recurringDay,
    recurringTime: task.recurringTime,
    timezone: task.timezone,
    enabled: task.enabled,
    lastRunAt: task.lastRunAt,
    nextRunAt: task.nextRunAt,
    runCount: task.runCount,
    createdAt: task.createdAt,
    source: 'local' as const,
  }));

  // Fetch from Agent Service
  let agentTasks: ScheduledTaskWithSource[] = [];
  try {
    const { createAgentClient } = await import('@/lib/agent-service');
    const client = createAgentClient(session.user.id, session.user.email || undefined, session.user.name || undefined);
    const agentJobs = await client.getCronJobs();
    
    // Get local task IDs to filter out duplicates (tasks that were synced from local to agent)
    const localTaskIds = new Set(localTasks.map(t => t.id));
    
    // Convert agent jobs to common format, excluding duplicates
    agentTasks = agentJobs
      .filter(job => !localTaskIds.has(job.id))
      .map(job => ({
        id: job.id,
        name: job.name,
        description: job.description,
        prompt: job.prompt,
        scheduleType: job.scheduleType,
        cronExpression: job.cronExpression,
        scheduledAt: job.scheduledAt ? new Date(job.scheduledAt) : null,
        recurringPattern: job.recurringPattern,
        recurringDay: job.recurringDay,
        recurringTime: job.recurringTime,
        timezone: job.timezone || 'UTC',
        enabled: job.enabled,
        lastRunAt: job.lastRunAt ? new Date(job.lastRunAt) : null,
        nextRunAt: job.nextRunAt ? new Date(job.nextRunAt) : null,
        runCount: job.runCount || 0,
        createdAt: new Date(job.createdAt),
        source: 'agent' as const,
      }));
  } catch (error) {
    console.error('Error fetching tasks from Agent Service:', error);
    // Continue with just local tasks if agent service is unavailable
  }

  // Merge and sort by creation date
  const allTasks = [...localTasksWithSource, ...agentTasks];
  allTasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return allTasks;
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

export async function updateScheduledTask(id: string, input: Partial<CreateScheduledTaskInput>, source: 'local' | 'agent' = 'local') {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  // Handle agent-sourced tasks
  if (source === 'agent') {
    try {
      const { createAgentClient } = await import('@/lib/agent-service');
      const client = createAgentClient(session.user.id, session.user.email || undefined, session.user.name || undefined);
      const updated = await client.updateCronJob(id, {
        name: input.name,
        description: input.description,
        prompt: input.prompt,
        scheduleType: input.scheduleType,
        cronExpression: input.cronExpression,
        scheduledAt: input.scheduledAt,
        recurringPattern: input.recurringPattern,
        recurringDay: input.recurringDay,
        recurringTime: input.recurringTime,
        timezone: input.timezone,
        enabled: input.enabled,
      });
      
      revalidatePath('/dashboard/settings/scheduled-tasks');
      return {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        prompt: updated.prompt,
        scheduleType: updated.scheduleType,
        cronExpression: updated.cronExpression,
        scheduledAt: updated.scheduledAt ? new Date(updated.scheduledAt) : null,
        recurringPattern: updated.recurringPattern,
        recurringDay: updated.recurringDay,
        recurringTime: updated.recurringTime,
        timezone: updated.timezone || 'UTC',
        enabled: updated.enabled,
        lastRunAt: updated.lastRunAt ? new Date(updated.lastRunAt) : null,
        nextRunAt: updated.nextRunAt ? new Date(updated.nextRunAt) : null,
        runCount: updated.runCount || 0,
        createdAt: new Date(updated.createdAt),
        source: 'agent' as const,
      };
    } catch (error) {
      console.error('Error updating agent task:', error);
      throw new Error('Failed to update task');
    }
  }

  // Handle local tasks
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
  return { ...task, source: 'local' as const };
}

export async function deleteScheduledTask(id: string, source: 'local' | 'agent' = 'local') {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  // Handle agent-sourced tasks
  if (source === 'agent') {
    try {
      const { createAgentClient } = await import('@/lib/agent-service');
      const client = createAgentClient(session.user.id, session.user.email || undefined, session.user.name || undefined);
      await client.deleteCronJob(id);
      revalidatePath('/dashboard/settings/scheduled-tasks');
      return;
    } catch (error) {
      console.error('Error deleting agent task:', error);
      throw new Error('Failed to delete task');
    }
  }

  // Handle local tasks
  const task = await prisma.scheduledTask.findUnique({ where: { id } });
  if (!task || task.userId !== session.user.id) {
    throw new Error('Task not found');
  }

  await prisma.scheduledTask.delete({ where: { id } });

  // Sync to Agent Service
  await syncTaskToAgentService(task, 'delete');

  revalidatePath('/dashboard/settings/scheduled-tasks');
}

export async function toggleScheduledTask(id: string, enabled: boolean, source: 'local' | 'agent' = 'local') {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  // Handle agent-sourced tasks
  if (source === 'agent') {
    try {
      const { createAgentClient } = await import('@/lib/agent-service');
      const client = createAgentClient(session.user.id, session.user.email || undefined, session.user.name || undefined);
      const updated = await client.toggleCronJob(id, enabled);
      
      revalidatePath('/dashboard/settings/scheduled-tasks');
      return {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        prompt: updated.prompt,
        scheduleType: updated.scheduleType,
        cronExpression: updated.cronExpression,
        scheduledAt: updated.scheduledAt ? new Date(updated.scheduledAt) : null,
        recurringPattern: updated.recurringPattern,
        recurringDay: updated.recurringDay,
        recurringTime: updated.recurringTime,
        timezone: updated.timezone || 'UTC',
        enabled: updated.enabled,
        lastRunAt: updated.lastRunAt ? new Date(updated.lastRunAt) : null,
        nextRunAt: updated.nextRunAt ? new Date(updated.nextRunAt) : null,
        runCount: updated.runCount || 0,
        createdAt: new Date(updated.createdAt),
        source: 'agent' as const,
      };
    } catch (error) {
      console.error('Error toggling agent task:', error);
      throw new Error('Failed to toggle task');
    }
  }

  // Handle local tasks
  const task = await prisma.scheduledTask.update({
    where: { id, userId: session.user.id },
    data: { enabled },
  });

  // Sync to Agent Service
  await syncTaskToAgentService(task, 'update');

  revalidatePath('/dashboard/settings/scheduled-tasks');
  return { ...task, source: 'local' as const };
}

export async function triggerScheduledTask(id: string, source: 'local' | 'agent' = 'local') {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  // For agent-sourced tasks, use the Agent Service client
  if (source === 'agent') {
    try {
      const { createAgentClient } = await import('@/lib/agent-service');
      const client = createAgentClient(session.user.id, session.user.email || undefined, session.user.name || undefined);
      await client.triggerCronJob(id);
      return { success: true };
    } catch (error) {
      console.error('Error triggering agent task:', error);
      throw new Error('Failed to trigger task');
    }
  }

  // Handle local tasks - still call Agent Service but via direct fetch
  const task = await prisma.scheduledTask.findUnique({ where: { id } });
  if (!task || task.userId !== session.user.id) {
    throw new Error('Task not found');
  }

  // Call Agent Service to trigger the job
  try {
    const { createAgentClient } = await import('@/lib/agent-service');
    const client = createAgentClient(session.user.id, session.user.email || undefined, session.user.name || undefined);
    await client.triggerCronJob(id);
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
