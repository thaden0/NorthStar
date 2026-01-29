import { Injectable, Logger } from '@nestjs/common';

export interface Client {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  hourlyRate: number;
  color: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateClientParams {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  hourlyRate?: number;
  color?: string;
  isActive?: boolean;
}

export interface UpdateClientParams {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  hourlyRate?: number;
  color?: string;
  isActive?: boolean;
}

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  /**
   * Get all clients for a user
   */
  async getClients(
    userId: string,
    authToken?: string
  ): Promise<{ success: boolean; data?: Client[]; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/clients`, {
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
   * Get a single client
   */
  async getClient(
    userId: string,
    clientId: string,
    authToken?: string
  ): Promise<{ success: boolean; data?: Client; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/clients/${clientId}`, {
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
      this.logger.error('Failed to get client:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Create a new client
   */
  async createClient(
    userId: string,
    params: CreateClientParams,
    authToken?: string
  ): Promise<{ success: boolean; data?: Client; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/clients`, {
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
      this.logger.error('Failed to create client:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Update a client
   */
  async updateClient(
    userId: string,
    clientId: string,
    params: UpdateClientParams,
    authToken?: string
  ): Promise<{ success: boolean; data?: Client; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/clients/${clientId}`, {
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
      this.logger.error('Failed to update client:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Delete a client
   */
  async deleteClient(
    userId: string,
    clientId: string,
    authToken?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/clients/${clientId}`, {
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
      this.logger.error('Failed to delete client:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
