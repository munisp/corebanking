import { Activity, MessageSquare, Send, Users } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
import ominiService from "../services/ominiService";
import { BACKEND_URL } from "../const";

interface ChannelStats {
  channel: string;
  totalSent: number;
  totalReceived: number;
  totalFailed: number;
  avgLatencyMs: number;
  successRate: number;
  isEnabled: boolean;
  isHealthy: boolean;
}

interface Message {
  id: string;
  channel: string;
  direction: "inbound" | "outbound";
  type: string;
  from: string;
  to: string;
  content: string;
  timestamp: string;
  status: string;
}

interface Conversation {
  id: string;
  channel: string;
  customerName: string;
  phoneNumber: string;
  lastMessage: string;
  lastActivity: string;
  messageCount: number;
  isActive: boolean;
}

interface ChannelConfig {
  channel: string;
  enabled: boolean;
  priority: number;
  rateLimit: number;
  credentials: Record<string, string>;
  settings: Record<string, any>;
}

const CommunicationHubDashboard: React.FC = () => {
  const { primaryColor } = useTenantBranding();
  const [activeTab, setActiveTab] = useState<
    "overview" | "channels" | "conversations" | "broadcast" | "settings"
  >("overview");
  const [channelStats, setChannelStats] = useState<ChannelStats[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [channelConfigs, setChannelConfigs] = useState<ChannelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [broadcastForm, setBroadcastForm] = useState({
    channels: [] as string[],
    recipients: "",
    content: "",
    type: "text",
  });
  const [channelSettings, setChannelSettings] = useState<Record<string, any>>(
    {},
  );
  const [savingSettings, setSavingSettings] = useState(false);

  const tenantId = localStorage.getItem("tenantId") || "default";

  const fetchChannelStats = useCallback(async () => {
    try {
      ominiService.setTenantId(tenantId);
      const channels = ["whatsapp", "ussd", "sms", "telegram"];
      const stats = await Promise.all(
        channels.map(async (channel) => {
          const data = await ominiService.getChannelStats(channel);
          return {
            channel,
            totalSent: data.total_sent || 0,
            totalReceived: data.total_received || 0,
            totalFailed: data.total_failed || 0,
            avgLatencyMs: data.avg_latency_ms || 0,
            successRate: data.success_rate || 0,
            isEnabled: true,
            isHealthy: true,
          };
        }),
      );
      setChannelStats(stats);
    } catch (err) {
      console.error("Error fetching channel stats:", err);
    }
  }, [tenantId]);

  const fetchRecentMessages = useCallback(async () => {
    try {
      ominiService.setTenantId(tenantId);
      const data = await ominiService.getRecentMessages(20);
      setRecentMessages(data || []);
    } catch (err) {
      console.error("Error fetching messages:", err);
      setRecentMessages([]);
    }
  }, [tenantId]);

  const fetchConversations = useCallback(async () => {
    try {
      ominiService.setTenantId(tenantId);
      const data = await ominiService.getActiveConversations();
      setConversations(data || []);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setConversations([]);
    }
  }, [tenantId]);

  const fetchChannelConfigs = useCallback(async () => {
    try {
      ominiService.setTenantId(tenantId);
      const data = await ominiService.getChannelConfigs();
      setChannelConfigs(
        (data || []).map((cfg: any) => ({
          ...cfg,
          rateLimit: cfg.rateLimit || 0,
        })),
      );
    } catch (err) {
      console.error("Error fetching channel configs:", err);
      setChannelConfigs([]);
    }
  }, [tenantId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchChannelStats(),
          fetchRecentMessages(),
          fetchConversations(),
          fetchChannelConfigs(),
        ]);
      } catch (err) {
        setError("Failed to load communication hub data");
      } finally {
        setLoading(false);
      }
    };

    loadData();

    const interval = setInterval(() => {
      fetchChannelStats();
      fetchRecentMessages();
    }, 30000);

    return () => clearInterval(interval);
  }, [
    fetchChannelStats,
    fetchRecentMessages,
    fetchConversations,
    fetchChannelConfigs,
  ]);

  // Load saved settings into form when channelConfigs are fetched
  useEffect(() => {
    if (channelConfigs.length > 0) {
      const settings: Record<string, any> = {};

      channelConfigs.forEach((config) => {
        // Set default callback URLs based on channel
        const defaultCallbackUrl =
          config.channel === "ussd"
            ? `${BACKEND_URL}/communication-hub/api/v1/ussd/callback`
            : config.channel === "sms"
              ? `${BACKEND_URL}/communication-hub/api/v1/sms/callback`
              : config.channel === "whatsapp"
                ? `${BACKEND_URL}/communication-hub/api/v1/whatsapp/callback`
                : "";

        const defaultDeliveryReportUrl =
          config.channel === "sms"
            ? `${BACKEND_URL}/communication-hub/api/v1/sms/delivery`
            : "";

        const defaultWebhookUrl =
          config.channel === "telegram"
            ? `${BACKEND_URL}/communication-hub/api/v1/telegram/webhook`
            : "";

        settings[config.channel] = {
          provider: config.credentials?.provider || "meta",
          apiKey: config.credentials?.api_key || "",
          username: config.credentials?.username || "",
          environment: config.credentials?.environment || "sandbox",
          senderId: config.credentials?.sender_id || "",
          shortcode:
            config.credentials?.shortcode ||
            config.credentials?.phone_number ||
            "",
          botToken: config.credentials?.bot_token || "",
          serviceCode: config.credentials?.service_code || "",
          waNumber: config.credentials?.wa_number || "",
          accessToken: config.credentials?.access_token || "",
          phoneNumberId: config.credentials?.phone_number_id || "",
          verifyToken: config.credentials?.verify_token || "",
          callbackUrl: config.settings?.callback_url || defaultCallbackUrl,
          deliveryReportUrl:
            config.settings?.delivery_report_url || defaultDeliveryReportUrl,
          webhookUrl: config.settings?.webhook_url || defaultWebhookUrl,
          sessionTimeout: config.settings?.session_timeout || 180,
          rateLimit: config.rateLimit || 1000,
        };
      });

      setChannelSettings(settings);
    }
  }, [channelConfigs]);

  const handleBroadcast = async () => {
    try {
      ominiService.setTenantId(tenantId);
      const recipients = broadcastForm.recipients
        .split("\n")
        .filter((r) => r.trim());

      await ominiService.broadcast({
        channels: broadcastForm.channels,
        recipients,
        content: broadcastForm.content,
        type: broadcastForm.type,
      });

      alert("Broadcast sent successfully!");
      setBroadcastForm({
        channels: [],
        recipients: "",
        content: "",
        type: "text",
      });
    } catch (err: any) {
      alert(`Failed to send broadcast: ${err.message}`);
    }
  };

  const handleToggleChannel = async (channel: string, enabled: boolean) => {
    try {
      ominiService.setTenantId(tenantId);
      await ominiService.updateChannelConfig({
        channel,
        enabled,
        priority: 1,
        rate_limit: 1000,
      });
      await fetchChannelConfigs();
    } catch (err: any) {
      alert(`Failed to update channel configuration: ${err.message}`);
    }
  };

  const handleSaveSettings = async (channel: string) => {
    setSavingSettings(true);
    try {
      const settings = channelSettings[channel] || {};

      await ominiService.updateChannelConfig({
        channel,
        enabled: true,
        priority: 1,
        rate_limit: settings.rateLimit || 1000,
        credentials: {
          provider: settings.provider || "meta",
          api_key: settings.apiKey || "",
          username: settings.username || "",
          environment: settings.environment || "sandbox",
          sender_id: settings.senderId || "",
          shortcode: settings.shortcode || "",
          phone_number: settings.shortcode || "",
          bot_token: settings.botToken || "",
          service_code: settings.serviceCode || "",
          wa_number: settings.waNumber || "",
          access_token: settings.accessToken || "",
          phone_number_id: settings.phoneNumberId || "",
          verify_token: settings.verifyToken || "",
        },
        settings: {
          callback_url: settings.callbackUrl || "",
          delivery_report_url: settings.deliveryReportUrl || "",
          webhook_url: settings.webhookUrl || "",
          session_timeout: settings.sessionTimeout || 180,
        },
      });

      alert(`${channel.toUpperCase()} settings saved successfully!`);
      await fetchChannelConfigs();
    } catch (error: any) {
      alert(`Failed to save settings: ${error.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSettingChange = (channel: string, field: string, value: any) => {
    setChannelSettings((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [field]: value,
      },
    }));
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "whatsapp":
        return "📱";
      case "ussd":
        return "📞";
      case "sms":
        return "💬";
      case "telegram":
        return "✈️";
      default:
        return "📨";
    }
  };

  const getStatusColor = (isHealthy: boolean) => {
    return isHealthy ? "bg-green-500" : "bg-red-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="w-12 h-12 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Communication Management"
          title="Communication Hub"
          description="Manage WhatsApp, USSD, SMS, and Telegram channels"
          icon={<MessageSquare className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-2 bg-card rounded-lg p-1 border border-border shadow-lg">
            {[
              "overview",
              "channels",
              "conversations",
              "broadcast",
              "settings",
            ].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  activeTab === tab
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                style={
                  activeTab === tab ? { backgroundColor: primaryColor } : {}
                }
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {channelStats.map((stat) => (
                <div
                  key={stat.channel}
                  className="bg-card rounded-xl shadow-lg p-6 border border-border"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <span className="text-2xl mr-2">
                        {getChannelIcon(stat.channel)}
                      </span>
                      <h3 className="text-lg font-semibold capitalize text-foreground">
                        {stat.channel}
                      </h3>
                    </div>
                    <div
                      className={`w-3 h-3 rounded-full ${getStatusColor(stat.isHealthy)}`}
                    ></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sent</span>
                      <span className="font-medium text-foreground">
                        {stat.totalSent?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Received</span>
                      <span className="font-medium text-foreground">
                        {stat.totalReceived?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Failed</span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {stat.totalFailed?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Success Rate
                      </span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {stat.successRate?.toFixed(1) || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Latency</span>
                      <span className="font-medium text-foreground">
                        {stat.avgLatencyMs?.toFixed(0) || 0}ms
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">
                  Recent Messages
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Channel
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Direction
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        From/To
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Content
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentMessages.map((msg) => (
                      <tr
                        key={msg.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="flex items-center text-foreground">
                            {getChannelIcon(msg.channel)}
                            <span className="ml-2 capitalize">
                              {msg.channel}
                            </span>
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              msg.direction === "inbound"
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                                : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                            }`}
                          >
                            {msg.direction}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {msg.direction === "inbound" ? msg.from : msg.to}
                        </td>
                        <td className="px-6 py-4 text-sm max-w-xs truncate text-foreground">
                          {msg.content}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              msg.status === "sent" ||
                              msg.status === "delivered"
                                ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                                : msg.status === "failed"
                                  ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                                  : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400"
                            }`}
                          >
                            {msg.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "channels" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {["whatsapp", "ussd", "sms", "telegram"].map((channel) => {
              const config = channelConfigs.find((c) => c.channel === channel);
              const stats = channelStats.find((s) => s.channel === channel);

              return (
                <div
                  key={channel}
                  className="bg-card rounded-xl shadow-lg p-6 border border-border"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <span className="text-3xl mr-3">
                        {getChannelIcon(channel)}
                      </span>
                      <div>
                        <h3 className="text-xl font-semibold capitalize text-foreground">
                          {channel}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {channel === "whatsapp" && "WhatsApp Business API"}
                          {channel === "ussd" && "USSD Banking (*123#)"}
                          {channel === "sms" && "SMS Banking"}
                          {channel === "telegram" && "Telegram Bot"}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config?.enabled ?? true}
                        onChange={(e) =>
                          handleToggleChannel(channel, e.target.checked)
                        }
                        className="sr-only peer"
                      />
                      <div
                        className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-opacity-30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all"
                        style={
                          {
                            "--tw-ring-color": primaryColor,
                          } as React.CSSProperties
                        }
                      ></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-muted/50 rounded-lg p-3 border border-border">
                      <p className="text-sm text-muted-foreground">
                        Messages Today
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {(stats?.totalSent || 0) + (stats?.totalReceived || 0)}
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 border border-border">
                      <p className="text-sm text-muted-foreground">
                        Success Rate
                      </p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {stats?.successRate?.toFixed(1) || 100}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rate Limit</span>
                      <span className="text-foreground">
                        {config?.rateLimit || 1000} req/min
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Priority</span>
                      <span className="text-foreground">
                        {config?.priority || 1}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          stats?.isHealthy
                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                            : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                        }`}
                      >
                        {stats?.isHealthy ? "Healthy" : "Unhealthy"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="text-sm font-medium mb-2 text-foreground">
                      Middleware Integration
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Kafka",
                        "Redis",
                        "Dapr",
                        "Temporal",
                        "TigerBeetle",
                        "Lakehouse",
                      ].map((mw) => (
                        <span
                          key={mw}
                          className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs border border-blue-200 dark:border-blue-800"
                        >
                          {mw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "conversations" && (
          <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-semibold text-foreground">
                Active Conversations
              </h3>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                style={
                  { "--tw-ring-color": primaryColor } as React.CSSProperties
                }
              >
                <option value="all">All Channels</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="ussd">USSD</option>
                <option value="sms">SMS</option>
                <option value="telegram">Telegram</option>
              </select>
            </div>
            <div className="divide-y divide-border">
              {conversations
                .filter(
                  (c) =>
                    selectedChannel === "all" || c.channel === selectedChannel,
                )
                .map((conv) => (
                  <div
                    key={conv.id}
                    className="p-6 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">
                          {getChannelIcon(conv.channel)}
                        </span>
                        <div>
                          <p className="font-medium text-foreground">
                            {conv.customerName || conv.phoneNumber}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {conv.phoneNumber}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {new Date(conv.lastActivity).toLocaleString()}
                        </p>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            conv.isActive
                              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400"
                          }`}
                        >
                          {conv.isActive ? "Active" : "Ended"}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground truncate">
                      {conv.lastMessage}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {conv.messageCount} messages
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === "broadcast" && (
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
              <Send className="w-5 h-5" style={{ color: primaryColor }} />
              Send Broadcast Message
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Select Channels
                </label>
                <div className="flex space-x-4">
                  {["whatsapp", "sms", "telegram"].map((channel) => (
                    <label key={channel} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={broadcastForm.channels.includes(channel)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBroadcastForm({
                              ...broadcastForm,
                              channels: [...broadcastForm.channels, channel],
                            });
                          } else {
                            setBroadcastForm({
                              ...broadcastForm,
                              channels: broadcastForm.channels.filter(
                                (c) => c !== channel,
                              ),
                            });
                          }
                        }}
                        className="mr-2"
                        style={{ accentColor: primaryColor }}
                      />
                      <span className="capitalize text-foreground">
                        {getChannelIcon(channel)} {channel}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Recipients (one per line)
                </label>
                <textarea
                  value={broadcastForm.recipients}
                  onChange={(e) =>
                    setBroadcastForm({
                      ...broadcastForm,
                      recipients: e.target.value,
                    })
                  }
                  rows={5}
                  className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                  style={
                    { "--tw-ring-color": primaryColor } as React.CSSProperties
                  }
                  placeholder="+2348012345678&#10;+2348087654321"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Message Content
                </label>
                <textarea
                  value={broadcastForm.content}
                  onChange={(e) =>
                    setBroadcastForm({
                      ...broadcastForm,
                      content: e.target.value,
                    })
                  }
                  rows={4}
                  className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                  style={
                    { "--tw-ring-color": primaryColor } as React.CSSProperties
                  }
                  placeholder="Enter your message here..."
                />
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {
                    broadcastForm.recipients.split("\n").filter((r) => r.trim())
                      .length
                  }{" "}
                  recipients selected
                </p>
                <button
                  onClick={handleBroadcast}
                  disabled={
                    !broadcastForm.channels.length ||
                    !broadcastForm.recipients ||
                    !broadcastForm.content
                  }
                  className="px-6 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Send className="w-4 h-4" />
                  Send Broadcast
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-6">
            {["whatsapp", "ussd", "sms", "telegram"].map((channel) => {
              const config = channelConfigs.find((c) => c.channel === channel);

              return (
                <div
                  key={channel}
                  className="bg-card rounded-xl shadow-lg p-6 border border-border"
                >
                  <div className="flex items-center mb-4">
                    <span className="text-2xl mr-2">
                      {getChannelIcon(channel)}
                    </span>
                    <h3 className="text-lg font-semibold capitalize text-foreground">
                      {channel} Settings
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Rate Limit (requests/minute)
                      </label>
                      <input
                        type="number"
                        defaultValue={config?.rateLimit || 1000}
                        className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                        style={
                          {
                            "--tw-ring-color": primaryColor,
                          } as React.CSSProperties
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Priority
                      </label>
                      <select
                        defaultValue={config?.priority || 1}
                        className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                        style={
                          {
                            "--tw-ring-color": primaryColor,
                          } as React.CSSProperties
                        }
                      >
                        <option value={1}>High (1)</option>
                        <option value={2}>Medium (2)</option>
                        <option value={3}>Low (3)</option>
                      </select>
                    </div>
                  </div>

                  {channel === "whatsapp" && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Provider
                        </label>
                        <select
                          value={channelSettings.whatsapp?.provider || "meta"}
                          onChange={(e) =>
                            handleSettingChange(
                              "whatsapp",
                              "provider",
                              e.target.value,
                            )
                          }
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        >
                          <option value="meta">Meta Cloud API (Free)</option>
                          <option value="africas_talking">
                            Africa's Talking
                          </option>
                        </select>
                      </div>

                      {channelSettings.whatsapp?.provider === "meta" ? (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              Access Token
                            </label>
                            <input
                              type="password"
                              value={
                                channelSettings.whatsapp?.accessToken || ""
                              }
                              onChange={(e) =>
                                handleSettingChange(
                                  "whatsapp",
                                  "accessToken",
                                  e.target.value,
                                )
                              }
                              placeholder="Enter Meta WhatsApp Access Token"
                              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                              style={
                                {
                                  "--tw-ring-color": primaryColor,
                                } as React.CSSProperties
                              }
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              From Meta Business Suite → WhatsApp → API Setup
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              Phone Number ID
                            </label>
                            <input
                              type="text"
                              value={
                                channelSettings.whatsapp?.phoneNumberId || ""
                              }
                              onChange={(e) =>
                                handleSettingChange(
                                  "whatsapp",
                                  "phoneNumberId",
                                  e.target.value,
                                )
                              }
                              placeholder="123456789012345"
                              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                              style={
                                {
                                  "--tw-ring-color": primaryColor,
                                } as React.CSSProperties
                              }
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              From Meta Business Suite → WhatsApp → API Setup
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              Webhook Verify Token
                            </label>
                            <input
                              type="text"
                              value={
                                channelSettings.whatsapp?.verifyToken || ""
                              }
                              onChange={(e) =>
                                handleSettingChange(
                                  "whatsapp",
                                  "verifyToken",
                                  e.target.value,
                                )
                              }
                              placeholder="my_verify_token_12345"
                              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                              style={
                                {
                                  "--tw-ring-color": primaryColor,
                                } as React.CSSProperties
                              }
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Create a random string for webhook verification
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              Environment
                            </label>
                            <select
                              value={
                                channelSettings.whatsapp?.environment ||
                                "sandbox"
                              }
                              onChange={(e) =>
                                handleSettingChange(
                                  "whatsapp",
                                  "environment",
                                  e.target.value,
                                )
                              }
                              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                              style={
                                {
                                  "--tw-ring-color": primaryColor,
                                } as React.CSSProperties
                              }
                            >
                              <option value="sandbox">
                                Sandbox (Development)
                              </option>
                              <option value="live">Live (Production)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              Username
                            </label>
                            <input
                              type="text"
                              value={channelSettings.whatsapp?.username || ""}
                              onChange={(e) =>
                                handleSettingChange(
                                  "whatsapp",
                                  "username",
                                  e.target.value,
                                )
                              }
                              placeholder="sandbox or your username"
                              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                              style={
                                {
                                  "--tw-ring-color": primaryColor,
                                } as React.CSSProperties
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              API Key
                            </label>
                            <input
                              type="password"
                              value={channelSettings.whatsapp?.apiKey || ""}
                              onChange={(e) =>
                                handleSettingChange(
                                  "whatsapp",
                                  "apiKey",
                                  e.target.value,
                                )
                              }
                              placeholder="Enter your Africa's Talking API Key"
                              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                              style={
                                {
                                  "--tw-ring-color": primaryColor,
                                } as React.CSSProperties
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              WhatsApp Number (waNumber)
                            </label>
                            <input
                              type="text"
                              value={channelSettings.whatsapp?.waNumber || ""}
                              onChange={(e) =>
                                handleSettingChange(
                                  "whatsapp",
                                  "waNumber",
                                  e.target.value,
                                )
                              }
                              placeholder="+2547XXXXXXXX"
                              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                              style={
                                {
                                  "--tw-ring-color": primaryColor,
                                } as React.CSSProperties
                              }
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Callback URL
                        </label>
                        <input
                          type="text"
                          value={channelSettings.whatsapp?.callbackUrl || ""}
                          onChange={(e) =>
                            handleSettingChange(
                              "whatsapp",
                              "callbackUrl",
                              e.target.value,
                            )
                          }
                          placeholder={`${BACKEND_URL}/communication-hub/api/v1/whatsapp/callback`}
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {channelSettings.whatsapp?.provider === "meta"
                            ? "Configure in Meta Business Suite → WhatsApp → Configuration → Webhooks"
                            : "Configure this URL in your Africa's Talking WhatsApp settings"}
                        </p>
                      </div>
                    </div>
                  )}

                  {channel === "telegram" && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Bot Token
                        </label>
                        <input
                          type="password"
                          value={channelSettings.telegram?.botToken || ""}
                          onChange={(e) =>
                            handleSettingChange(
                              "telegram",
                              "botToken",
                              e.target.value,
                            )
                          }
                          placeholder="Enter Telegram Bot Token (from @BotFather)"
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Webhook URL
                        </label>
                        <input
                          type="text"
                          value={channelSettings.telegram?.webhookUrl || ""}
                          onChange={(e) =>
                            handleSettingChange(
                              "telegram",
                              "webhookUrl",
                              e.target.value,
                            )
                          }
                          placeholder={`${BACKEND_URL}/communication-hub/api/v1/telegram/webhook`}
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Get your bot token from @BotFather on Telegram. Then
                          set this webhook URL using:
                          <code className="text-xs bg-muted px-1 rounded">
                            {`https://api.telegram.org/bot`}&lt;token&gt;{`/setWebhook?url=${BACKEND_URL}/communication-hub/api/v1/telegram/webhook`}
                          </code>
                        </p>
                      </div>
                    </div>
                  )}

                  {channel === "sms" && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          SMS Provider
                        </label>
                        <select
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        >
                          <option value="africas_talking">
                            Africa's Talking
                          </option>
                          <option value="twilio">Twilio</option>
                          <option value="infobip">Infobip</option>
                          <option value="termii">Termii</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Environment
                        </label>
                        <select
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        >
                          <option value="sandbox">Sandbox (Development)</option>
                          <option value="live">Live (Production)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          value={channelSettings.sms?.username || ""}
                          onChange={(e) =>
                            handleSettingChange(
                              "sms",
                              "username",
                              e.target.value,
                            )
                          }
                          placeholder="sandbox (for dev) or your username (for live)"
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          API Key
                        </label>
                        <input
                          type="password"
                          value={channelSettings.sms?.apiKey || ""}
                          onChange={(e) =>
                            handleSettingChange("sms", "apiKey", e.target.value)
                          }
                          placeholder="Enter your Africa's Talking API Key"
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Sender ID
                        </label>
                        <input
                          type="text"
                          value={channelSettings.sms?.senderId || ""}
                          onChange={(e) =>
                            handleSettingChange(
                              "sms",
                              "senderId",
                              e.target.value,
                            )
                          }
                          placeholder="54link-dev"
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          The name that appears as sender of outgoing SMS
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Shortcode / Phone Number
                        </label>
                        <input
                          type="text"
                          value={channelSettings.sms?.shortcode || ""}
                          onChange={(e) =>
                            handleSettingChange(
                              "sms",
                              "shortcode",
                              e.target.value,
                            )
                          }
                          placeholder="29930 or +254700000000"
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Your SMS shortcode or dedicated phone number for
                          receiving messages
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Incoming SMS Callback URL
                        </label>
                        <input
                          type="text"
                          value={
                            channelSettings.sms?.callbackUrl ||
                            `${BACKEND_URL}/communication-hub/api/v1/sms/callback`
                          }
                          onChange={(e) =>
                            handleSettingChange(
                              "sms",
                              "callbackUrl",
                              e.target.value,
                            )
                          }
                          placeholder={`${BACKEND_URL}/communication-hub/api/v1/sms/callback`}
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          For receiving incoming SMS messages
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Delivery Report URL
                        </label>
                        <input
                          type="text"
                          value={
                            channelSettings.sms?.deliveryReportUrl ||
                            `${BACKEND_URL}/communication-hub/api/v1/sms/delivery`
                          }
                          onChange={(e) =>
                            handleSettingChange(
                              "sms",
                              "deliveryReportUrl",
                              e.target.value,
                            )
                          }
                          placeholder={`${BACKEND_URL}/communication-hub/api/v1/sms/delivery`}
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          For SMS delivery status updates
                        </p>
                      </div>
                    </div>
                  )}

                  {channel === "ussd" && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Environment
                        </label>
                        <select
                          value={channelSettings.ussd?.environment || "sandbox"}
                          onChange={(e) =>
                            handleSettingChange(
                              "ussd",
                              "environment",
                              e.target.value,
                            )
                          }
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        >
                          <option value="sandbox">Sandbox (Development)</option>
                          <option value="live">Live (Production)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          value={channelSettings.ussd?.username || ""}
                          onChange={(e) =>
                            handleSettingChange(
                              "ussd",
                              "username",
                              e.target.value,
                            )
                          }
                          placeholder="sandbox or your username"
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          API Key
                        </label>
                        <input
                          type="password"
                          value={channelSettings.ussd?.apiKey || ""}
                          onChange={(e) =>
                            handleSettingChange(
                              "ussd",
                              "apiKey",
                              e.target.value,
                            )
                          }
                          placeholder="Enter your Africa's Talking API Key"
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Service Code
                        </label>
                        <input
                          type="text"
                          value={channelSettings.ussd?.serviceCode || ""}
                          onChange={(e) =>
                            handleSettingChange(
                              "ussd",
                              "serviceCode",
                              e.target.value,
                            )
                          }
                          placeholder="*384#"
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Callback URL
                        </label>
                        <input
                          type="text"
                          value={
                            channelSettings.ussd?.callbackUrl ||
                            `${BACKEND_URL}/communication-hub/api/v1/ussd/callback`
                          }
                          onChange={(e) =>
                            handleSettingChange(
                              "ussd",
                              "callbackUrl",
                              e.target.value,
                            )
                          }
                          placeholder={`${BACKEND_URL}/communication-hub/api/v1/ussd/callback`}
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Copy this URL to Africa's Talking USSD settings
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Session Timeout (seconds)
                        </label>
                        <input
                          type="number"
                          value={channelSettings.ussd?.sessionTimeout || 180}
                          onChange={(e) =>
                            handleSettingChange(
                              "ussd",
                              "sessionTimeout",
                              parseInt(e.target.value),
                            )
                          }
                          className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2"
                          style={
                            {
                              "--tw-ring-color": primaryColor,
                            } as React.CSSProperties
                          }
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-border flex justify-end">
                    <button
                      onClick={() => handleSaveSettings(channel)}
                      disabled={savingSettings}
                      className="px-4 py-2 text-white rounded-lg hover:opacity-90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {savingSettings ? "Saving..." : "Save Settings"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunicationHubDashboard;
