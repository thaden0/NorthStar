import { Injectable, Logger } from '@nestjs/common';

export interface FileRecord {
  id: string;
  name: string;
  key: string;
  url: string;
  size: number;
  type: string;
  uploadedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFileParams {
  name: string;
  key: string;
  url: string;
  size: number;
  type: string;
}

export interface UpdateFileParams {
  name?: string;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  /**
   * Get all files for a user
   */
  async getFiles(
    userId: string,
    options: { type?: string; limit?: number } = {},
    authToken?: string
  ): Promise<{ success: boolean; data?: FileRecord[]; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      const url = new URL('/api/files', baseUrl);
      
      if (options.type) url.searchParams.set('type', options.type);
      if (options.limit) url.searchParams.set('limit', String(options.limit));
      
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
      this.logger.error('Failed to get files:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get a single file
   */
  async getFile(
    userId: string,
    fileId: string,
    authToken?: string
  ): Promise<{ success: boolean; data?: FileRecord; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/files/${fileId}`, {
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
      this.logger.error('Failed to get file:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Create a new file record
   */
  async createFile(
    userId: string,
    params: CreateFileParams,
    authToken?: string
  ): Promise<{ success: boolean; data?: FileRecord; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/files`, {
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
      this.logger.error('Failed to create file:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Update a file record
   */
  async updateFile(
    userId: string,
    fileId: string,
    params: UpdateFileParams,
    authToken?: string
  ): Promise<{ success: boolean; data?: FileRecord; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/files/${fileId}`, {
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
      this.logger.error('Failed to update file:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Delete a file record
   */
  async deleteFile(
    userId: string,
    fileId: string,
    authToken?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/files/${fileId}`, {
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
      this.logger.error('Failed to delete file:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
