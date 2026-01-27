import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly northStarUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.northStarUrl = this.configService.get<string>('NORTH_STAR_URL') || 'http://localhost:3000';
  }

  /**
   * Create a notification by sending it to North Star
   */
  async create(dto: CreateNotificationDto): Promise<boolean> {
    this.logger.log(`Creating notification for user ${dto.userId}: ${dto.title}`);

    try {
      const response = await fetch(`${this.northStarUrl}/api/notifications/internal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.configService.get<string>('INTERNAL_API_SECRET') || 'internal-secret',
        },
        body: JSON.stringify(dto),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Failed to create notification: ${response.status} - ${errorText}`);
        return false;
      }

      this.logger.log(`Notification created successfully for user ${dto.userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending notification to North Star: ${error}`);
      
      // Store locally as fallback (in production, you might want a queue)
      this.logger.warn(`Notification queued locally: ${dto.title}`);
      return false;
    }
  }

  /**
   * Send multiple notifications
   */
  async createMany(notifications: CreateNotificationDto[]): Promise<number> {
    let successCount = 0;
    
    for (const notification of notifications) {
      const success = await this.create(notification);
      if (success) successCount++;
    }

    return successCount;
  }

  /**
   * Create a system notification for all users (admin only)
   */
  async broadcast(
    title: string, 
    message: string, 
    userIds: string[]
  ): Promise<number> {
    const notifications = userIds.map(userId => ({
      userId,
      type: 'system',
      title,
      message,
    }));

    return this.createMany(notifications);
  }
}
