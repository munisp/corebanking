/**
 * Omini-Service API Client
 * Connects to Communication Hub backend (Port 8124)
 */

import { BACKEND_URL } from "../const";

const OMINI_API_BASE =
  import.meta.env.VITE_OMINI_API || `${BACKEND_URL}/communication-hub`;

interface SendMessageRequest {
  channel: "whatsapp" | "ussd" | "sms" | "telegram";
  to: string;
  content: string;
  type: "text" | "image" | "document" | "audio" | "video";
  metadata?: Record<string, any>;
}

interface BroadcastRequest {
  channels: string[];
  recipients: string[];
  content: string;
  type: string;
}

interface ChannelStats {
  channel: string;
  total_sent: number;
  total_received: number;
  total_failed: number;
  success_rate: number;
  avg_latency_ms: number;
  active_conversations?: number;
}

interface ChannelConfig {
  channel: string;
  enabled: boolean;
  priority: number;
  rate_limit: number;
  credentials?: Record<string, string>;
  settings?: Record<string, any>;
}

interface Message {
  id: string;
  tenant_id: string;
  channel: string;
  direction: "inbound" | "outbound";
  type: string;
  from: string;
  to: string;
  content: string;
  timestamp: string;
  status: string;
  customer_id?: string;
  session_id?: string;
}

class OminiService {
  private tenantId: string = "default";

  setTenantId(tenantId: string) {
    this.tenantId = tenantId;
  }

  private getHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
      "X-Tenant-ID": this.tenantId,
    };
  }

  /**
   * Send a single message
   */
  async sendMessage(request: SendMessageRequest): Promise<any> {
    const response = await fetch(`${OMINI_API_BASE}/api/v1/send`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send message: ${error}`);
    }

    return response.json();
  }

  /**
   * Broadcast message to multiple recipients across channels
   */
  async broadcast(request: BroadcastRequest): Promise<any[]> {
    const response = await fetch(`${OMINI_API_BASE}/api/v1/broadcast`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to broadcast: ${error}`);
    }

    return response.json();
  }

  /**
   * Get conversation history for a customer
   */
  async getConversation(
    customerId: string,
    channel: string,
  ): Promise<Message[]> {
    const response = await fetch(
      `${OMINI_API_BASE}/api/v1/conversation?customer_id=${customerId}&channel=${channel}`,
      {
        headers: this.getHeaders(),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get conversation: ${error}`);
    }

    return response.json();
  }

  /**
   * Get channel statistics
   */
  async getChannelStats(channel?: string): Promise<ChannelStats> {
    const url = channel
      ? `${OMINI_API_BASE}/api/v1/stats?channel=${channel}`
      : `${OMINI_API_BASE}/api/v1/stats`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get stats: ${error}`);
    }

    return response.json();
  }

  /**
   * Update channel configuration
   */
  async updateChannelConfig(config: ChannelConfig): Promise<void> {
    const response = await fetch(`${OMINI_API_BASE}/api/v1/channel/config`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update config: ${error}`);
    }
  }

  /**
   * Get health status of all channels
   */
  async getHealth(): Promise<any> {
    const response = await fetch(`${OMINI_API_BASE}/health`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Health check failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Get all channel configurations
   */
  async getChannelConfigs(): Promise<ChannelConfig[]> {
    const response = await fetch(`${OMINI_API_BASE}/api/v1/channels/config`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      // If endpoint doesn't exist yet, return default configs
      const channels = ["whatsapp", "ussd", "sms", "telegram"];
      return channels.map((channel) => ({
        channel,
        enabled: true,
        priority: 1,
        rate_limit: 1000,
        credentials: {},
        settings: {},
      }));
    }

    const data = await response.json();
    return data.configs || data;
  }

  /**
   * Get recent messages
   */
  async getRecentMessages(limit: number = 20): Promise<Message[]> {
    try {
      const response = await fetch(
        `${OMINI_API_BASE}/api/v1/messages/recent?limit=${limit}`,
        {
          headers: this.getHeaders(),
        },
      );

      if (!response.ok) {
        console.warn("Failed to fetch recent messages:", response.status);
        return [];
      }

      const data = await response.json();

      // Handle different response formats
      if (Array.isArray(data)) {
        return data;
      }
      if (data.messages && Array.isArray(data.messages)) {
        return data.messages;
      }

      console.warn("Unexpected response format for messages:", data);
      return [];
    } catch (error) {
      console.error("Error fetching recent messages:", error);
      return [];
    }
  }

  /**
   * Get active conversations
   */
  async getActiveConversations(): Promise<any[]> {
    try {
      const response = await fetch(
        `${OMINI_API_BASE}/api/v1/conversations?status=active`,
        {
          headers: this.getHeaders(),
        },
      );

      if (!response.ok) {
        console.warn("Failed to fetch conversations:", response.status);
        return [];
      }

      const data = await response.json();

      // Handle different response formats
      if (Array.isArray(data)) {
        return data;
      }
      if (data.conversations && Array.isArray(data.conversations)) {
        return data.conversations;
      }

      console.warn("Unexpected response format for conversations:", data);
      return [];
    } catch (error) {
      console.error("Error fetching conversations:", error);
      return [];
    }
  }

  /**
   * Get conversations (legacy method)
   */
  async getConversations(status: string = "active"): Promise<any[]> {
    return this.getActiveConversations();
  }
}

export const ominiService = new OminiService();
export default ominiService;
