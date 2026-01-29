import { Injectable, Logger } from '@nestjs/common';

export interface TimeEntry {
  id: string;
  userId: string;
  clientId: string | null;
  projectId: string | null;
  startTimeUtc: Date;
  endTimeUtc: Date;
  description: string | null;
  billable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTimeEntryParams {
  clientId?: string;
  projectId?: string;
  startTimeUtc: string; // ISO string
  endTimeUtc: string;   // ISO string
  description?: string;
  billable?: boolean;
}

export interface UpdateTimeEntryParams {
  clientId?: string | null;
  projectId?: string | null;
  startTimeUtc?: string;
  endTimeUtc?: string;
  description?: string | null;
  billable?: boolean;
}

export interface Client {
  id: string;
  name: string;
  color: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  hourlyRate: number | null;
}

@Injectable()
export class TimeTrackingService {
  private readonly logger = new Logger(TimeTrackingService.name);

  /**
   * Get time entries for a user within a date range
   */
  async getTimeEntries(
    userId: string,
    startDate: Date,
    endDate: Date,
    authToken?: string
  ): Promise<{ success: boolean; data?: TimeEntry[]; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      const url = new URL('/api/time-tracking/entries', baseUrl);
      url.searchParams.set('startDate', startDate.toISOString());
      url.searchParams.set('endDate', endDate.toISOString());

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
      return { success: true, data: result.data };
    } catch (error) {
      this.logger.error('Failed to get time entries:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Create a new time entry
   */
  async createTimeEntry(
    userId: string,
    params: CreateTimeEntryParams,
    authToken?: string
  ): Promise<{ success: boolean; data?: TimeEntry; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/time-tracking/entries`, {
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
      this.logger.error('Failed to create time entry:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Update an existing time entry
   */
  async updateTimeEntry(
    userId: string,
    entryId: string,
    params: UpdateTimeEntryParams,
    authToken?: string
  ): Promise<{ success: boolean; data?: TimeEntry; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/time-tracking/entries/${entryId}`, {
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
      this.logger.error('Failed to update time entry:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Delete a time entry
   */
  async deleteTimeEntry(
    userId: string,
    entryId: string,
    authToken?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/time-tracking/entries/${entryId}`, {
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
      this.logger.error('Failed to delete time entry:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get all clients for a user
   */
  async getClients(
    userId: string,
    authToken?: string
  ): Promise<{ success: boolean; data?: Client[]; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/time-tracking/clients`, {
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
      this.logger.error('Failed to get clients:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get all projects for a user
   */
  async getProjects(
    userId: string,
    authToken?: string
  ): Promise<{ success: boolean; data?: Project[]; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/time-tracking/projects`, {
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
      this.logger.error('Failed to get projects:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
