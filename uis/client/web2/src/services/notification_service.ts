import { AppConfig } from '../config/app_config';
import { apiService } from './api_service';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'transaction' | 'alert' | 'general';
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
}

export class NotificationService {
  async getNotifications(): Promise<Notification[]> {
    try {
      const response = await apiService.get(AppConfig.notificationEndpoint);

      if (response.status === 200) {
        const data = response.data as { data?: Record<string, unknown>[]; message?: string };
        const notificationsList = data.data as Record<string, unknown>[];
        return notificationsList.map((json) => this.parseNotification(json));
      } else {
        const data = response.data as { message?: string };
        throw new Error(data.message || 'Failed to fetch notifications');
      }
    } catch (error: unknown) {
      throw new Error(`Failed to fetch notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    try {
      const response = await apiService.put(`${AppConfig.notificationEndpoint}/${notificationId}/read`, {});

      if (response.status !== 200) {
        const data = response.data as { message?: string };
        throw new Error(data.message || 'Failed to mark notification as read');
      }
    } catch (error: unknown) {
      throw new Error(`Failed to mark notification as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async markAllAsRead(): Promise<void> {
    try {
      const response = await apiService.put(`${AppConfig.notificationEndpoint}/mark-all-read`, {});

      if (response.status !== 200) {
        const data = response.data as { message?: string };
        throw new Error(data.message || 'Failed to mark all notifications as read');
      }
    } catch (error: unknown) {
      throw new Error(`Failed to mark all notifications as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const response = await apiService.delete(`${AppConfig.notificationEndpoint}/${notificationId}`);

      if (response.status !== 200) {
        const data = response.data as { message?: string };
        throw new Error(data.message || 'Failed to delete notification');
      }
    } catch (error: unknown) {
      throw new Error(`Failed to delete notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseNotification(json: Record<string, unknown>): Notification {
    return {
      id: json.id as string,
      userId: json.user_id as string,
      title: json.title as string,
      body: json.body as string,
      type: json.type as Notification['type'],
      isRead: json.is_read as boolean,
      createdAt: new Date(json.created_at as string),
      readAt: json.read_at ? new Date(json.read_at as string) : undefined,
    };
  }
}

export const notificationService = new NotificationService();