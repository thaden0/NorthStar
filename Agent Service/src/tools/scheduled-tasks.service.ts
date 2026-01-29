import { Injectable, Logger } from '@nestjs/common';

export interface ScheduledTask {
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
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  runCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduledTaskParams {
  name: string;
  description?: string;
  prompt: string;
  scheduleType: 'once' | 'recurring' | 'cron';
  cronExpression?: string;
  scheduledAt?: string;
  recurringPattern?: string;
  recurringDay?: number;
  recurringTime?: string;
  timezone?: string;
  enabled?: boolean;
}

export interface UpdateScheduledTaskParams {
  name?: string;
  description?: string;
  prompt?: string;
  scheduleType?: string;
  cronExpression?: string;
  scheduledAt?: string;
  recurringPattern?: string;
  recurringDay?: number;
  recurringTime?: string;
  timezone?: string;
  enabled?: boolean;
}

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  /**
   * Get all scheduled tasks for a user
   */
  async getScheduledTasks(
    userId: string,
    authToken?: string
  ): Promise<{ success: boolean; data?: ScheduledTask[]; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/scheduled-tasks`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `API error: ${error}` };
      }

      const result = await response.json();
      return { success: true, data: result.data };
    } catch (error) {
      this.logger.error('Failed to get scheduled tasks:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Create a new scheduled task
   */
  async createScheduledTask(
    userId: string,
    params: CreateScheduledTaskParams,
    authToken?: string
  ): Promise<{ success: boolean; data?: ScheduledTask; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/scheduled-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `API error: ${error}` };
      }

      const result = await response.json();
      return { success: true, data: result.data };
    } catch (error) {
      this.logger.error('Failed to create scheduled task:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Update a scheduled task
   */
  async updateScheduledTask(
    userId: string,
    taskId: string,
    params: UpdateScheduledTaskParams,
    authToken?: string
  ): Promise<{ success: boolean; data?: ScheduledTask; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/scheduled-tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `API error: ${error}` };
      }

      const result = await response.json();
      return { success: true, data: result.data };
    } catch (error) {
      this.logger.error('Failed to update scheduled task:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Delete a scheduled task
   */
  async deleteScheduledTask(
    userId: string,
    taskId: string,
    authToken?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/scheduled-tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `API error: ${error}` };
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to delete scheduled task:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Toggle a scheduled task's enabled status
   */
  async toggleScheduledTask(
    userId: string,
    taskId: string,
    enabled: boolean,
    authToken?: string
  ): Promise<{ success: boolean; data?: ScheduledTask; error?: string }> {
    return this.updateScheduledTask(userId, taskId, { enabled }, authToken);
  }
}
