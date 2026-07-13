import { AlertCircle, Bell, CheckCircle, XCircle } from "lucide-react";
import React, { useEffect, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

type NotificationType = "transaction" | "alert" | "general";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  timestamp: Date;
  icon: React.ReactNode;
  iconColor: string;
}

export default function NotificationScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("all");

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    
    try {
      const { notificationService } = await import('../../../services/notification_service');
      const notifData = await notificationService.getNotifications();
      
      // Map API notifications to UI format
      const mappedNotifications: NotificationItem[] = notifData.map((notif) => {
        let icon = <Bell size={22} />;
        let iconColor = 'text-[var(--primary-color)]';
        
        if (notif.type === 'transaction') {
          icon = <CheckCircle size={22} />;
          iconColor = 'text-green-600';
        } else if (notif.type === 'alert') {
          icon = <AlertCircle size={22} />;
          iconColor = 'text-orange-600';
        }
        
        return {
          id: notif.id,
          title: notif.title,
          message: notif.body,
          type: notif.type as NotificationType,
          isRead: notif.isRead,
          timestamp: notif.createdAt,
          icon,
          iconColor,
        };
      });
      
      setNotifications(mappedNotifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      // Fallback to empty array
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (selectedFilter === "unread") return !n.isRead;
    if (selectedFilter === "alerts") return n.type === "alert";
    if (selectedFilter === "transactions") return n.type === "transaction";
    return true;
  });

  const markAllAsRead = async () => {
    try {
      const { notificationService } = await import('../../../services/notification_service');
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const formatTimestamp = (time: Date) => {
    const diff = Date.now() - time.getTime();
    const min = diff / 60000;

    if (min < 1) return "Just now";
    if (min < 60) return `${Math.floor(min)}m ago`;
    if (min < 1440) return `${Math.floor(min / 60)}h ago`;
    if (min < 10080) return `${Math.floor(min / 1440)}d ago`;

    return time.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-full transition"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-[var(--primary-color)] font-medium hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Stay Updated Section */}
      <div className="bg-white px-5 py-5">
        <h2 className="text-2xl font-bold">Stay Updated</h2>
        <p className="text-gray-600 mt-1">
          {unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
            : "You're all caught up!"}
        </p>
      </div>

      {/* Filter Chips */}
      <div className="bg-white px-4 py-3 flex gap-3 overflow-x-auto scrollbar-hide">
        {[
          { label: "All", value: "all" },
          { label: "Unread", value: "unread" },
          { label: "Transactions", value: "transactions" },
          { label: "Alerts", value: "alerts" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setSelectedFilter(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm border ${
              selectedFilter === f.value
                ? "bg-[var(--primary-color)] text-white border-[var(--primary-color)]"
                : "bg-white text-gray-700 border-gray-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col justify-center items-center mt-20">
          <div className="animate-spin h-10 w-10 border-4 border-[var(--primary-color)] border-t-transparent rounded-full"></div>
          <p className="text-gray-600 mt-3">Loading notifications...</p>
        </div>
      ) : (
        <div className="p-4">
          {filteredNotifications.length === 0 ? (
            <div className="text-center mt-20">
              <Bell size={80} className="mx-auto text-gray-300" />
              <p className="text-lg mt-4 font-medium text-gray-600">
                No notifications
              </p>
              <p className="text-gray-500 text-sm">You're all caught up!</p>
            </div>
          ) : (
            filteredNotifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start p-4 mb-3 rounded-xl shadow-sm border ${
                  n.isRead
                    ? "bg-white border-gray-200"
                    : "bg-blue-50 border-[var(--primary-color)]"
                }`}
              >
                {/* Icon */}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center bg-opacity-10 ${n.iconColor}`}
                >
                  <div className={n.iconColor}>{n.icon}</div>
                </div>

                {/* Content */}
                <div className="flex-1 ml-3">
                  <div className="flex justify-between">
                    <h3
                      className={`font-semibold ${
                        n.isRead ? "text-gray-800" : "text-[var(--primary-color)]"
                      }`}
                    >
                      {n.title}
                    </h3>

                    {!n.isRead && (
                      <span className="w-3 h-3 bg-[var(--primary-color)] rounded-full"></span>
                    )}
                  </div>

                  <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                    {n.message}
                  </p>

                  <p className="text-gray-400 text-xs mt-2">
                    {formatTimestamp(n.timestamp)}
                  </p>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => deleteNotification(n.id)}
                  className="ml-3 text-red-600 hover:text-red-800"
                >
                  <XCircle size={20} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
