import { Injectable, Logger } from '@nestjs/common';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: Date;
}

export interface CreateNotificationParams {
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface UpdateNotificationParams {
  read?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /**
   * Get all notifications for a user
   */
  async getNotifications(
    userId: string,
    options: { limit?: number; unreadOnly?: boolean } = {},
    authToken?: string
  ): Promise<{ success: boolean; data?: Notification[]; unreadCount?: number; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      const url = new URL('/api/notifications', baseUrl);
      
      if (options.limit) url.searchParams.set('limit', String(options.limit));
      if (options.unreadOnly) url.searchParams.set('unreadOnly', 'true');
      
      const response = await fetch(url.toString(), {
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
      return { success: true, data: result.data, unreadCount: result.unreadCount };
    } catch (error) {
      this.logger.error('Failed to get notifications:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get a single notification
   */
  async getNotification(
    userId: string,
    notificationId: string,
    authToken?: string
  ): Promise<{ success: boolean; data?: Notification; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/notifications/${notificationId}`, {
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
      this.logger.error('Failed to get notification:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Create a new notification
   */
  async createNotification(
    userId: string,
    params: CreateNotificationParams,
    authToken?: string
  ): Promise<{ success: boolean; data?: Notification; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/notifications`, {
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
      this.logger.error('Failed to create notification:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Update a notification (mark as read)
   */
  async updateNotification(
    userId: string,
    notificationId: string,
    params: UpdateNotificationParams,
    authToken?: string
  ): Promise<{ success: boolean; data?: Notification; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/notifications/${notificationId}`, {
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
      this.logger.error('Failed to update notification:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(
    userId: string,
    notificationId: string,
    authToken?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/notifications/${notificationId}`, {
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
      this.logger.error('Failed to delete notification:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(
    userId: string,
    authToken?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/notifications/mark-all-read`, {
        method: 'POST',
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
      this.logger.error('Failed to mark all notifications as read:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
