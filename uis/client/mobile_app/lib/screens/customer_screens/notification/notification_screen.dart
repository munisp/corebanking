import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../config/app_theme.dart';
import '../../../providers/tenant_provider.dart';
import '../../../utils/tenant_utils.dart';

class NotificationScreen extends StatefulWidget {
  const NotificationScreen({super.key});

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  bool _isLoading = true;
  List<NotificationItem> _notifications = [];
  String _selectedFilter = 'all'; // all, unread, transactions, alerts

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() {
      _isLoading = true;
    });

    // Simulate API call
    await Future.delayed(const Duration(seconds: 1));

    // Sample notifications data
    setState(() {
      _notifications = [
        NotificationItem(
          id: '1',
          title: 'Transaction Successful',
          message: 'Your transfer of ₦50,000 to John Doe was successful',
          type: NotificationType.transaction,
          isRead: false,
          timestamp: DateTime.now().subtract(const Duration(minutes: 5)),
          icon: Icons.check_circle,
          iconColor: AppTheme.successColor,
        ),
        NotificationItem(
          id: '2',
          title: 'Bill Payment Reminder',
          message: 'Your electricity bill is due in 2 days',
          type: NotificationType.alert,
          isRead: false,
          timestamp: DateTime.now().subtract(const Duration(hours: 2)),
          icon: Icons.lightbulb_outline,
          iconColor: Colors.orange,
        ),
        NotificationItem(
          id: '3',
          title: 'Account Credited',
          message: 'Your account has been credited with ₦25,000',
          type: NotificationType.transaction,
          isRead: true,
          timestamp: DateTime.now().subtract(const Duration(hours: 5)),
          icon: Icons.arrow_downward,
          iconColor: AppTheme.successColor,
        ),
        NotificationItem(
          id: '4',
          title: 'Security Alert',
          message: 'New login detected from Lagos, Nigeria',
          type: NotificationType.alert,
          isRead: true,
          timestamp: DateTime.now().subtract(const Duration(days: 1)),
          icon: Icons.security,
          iconColor: AppTheme.errorColor,
        ),
        NotificationItem(
          id: '5',
          title: 'Transfer Failed',
          message: 'Your transfer of ₦10,000 failed. Insufficient balance',
          type: NotificationType.transaction,
          isRead: true,
          timestamp: DateTime.now().subtract(const Duration(days: 1)),
          icon: Icons.cancel,
          iconColor: AppTheme.errorColor,
        ),
        NotificationItem(
          id: '6',
          title: 'Welcome to pup',
          message: 'Thank you for joining us! Explore our features',
          type: NotificationType.general,
          isRead: true,
          timestamp: DateTime.now().subtract(const Duration(days: 2)),
          icon: Icons.celebration,
          iconColor: AppTheme.primaryColor,
        ),
      ];
      _isLoading = false;
    });
  }

  List<NotificationItem> get _filteredNotifications {
    switch (_selectedFilter) {
      case 'unread':
        return _notifications.where((n) => !n.isRead).toList();
      case 'transactions':
        return _notifications
            .where((n) => n.type == NotificationType.transaction)
            .toList();
      case 'alerts':
        return _notifications
            .where((n) => n.type == NotificationType.alert)
            .toList();
      default:
        return _notifications;
    }
  }

  void _markAsRead(String id) {
    setState(() {
      final index = _notifications.indexWhere((n) => n.id == id);
      if (index != -1) {
        _notifications[index].isRead = true;
      }
    });
  }

  void _markAllAsRead() {
    setState(() {
      for (var notification in _notifications) {
        notification.isRead = true;
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('All notifications marked as read'),
        backgroundColor: AppTheme.successColor,
      ),
    );
  }

  void _deleteNotification(String id) {
    setState(() {
      _notifications.removeWhere((n) => n.id == id);
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Notification deleted'),
        backgroundColor: AppTheme.successColor,
      ),
    );
  }

  String _formatTimestamp(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);

    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h ago';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return DateFormat('MMM dd, yyyy').format(timestamp);
    }
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _notifications.where((n) => !n.isRead).length;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: AppTheme.getCardBackground(context),
        elevation: 0,
        title: Text(
          'Notifications',
          style: TextStyle(
            color: AppTheme.getTextPrimary(context),
            fontWeight: FontWeight.w600,
          ),
        ),
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back,
            color: AppTheme.getTextPrimary(context),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          if (unreadCount > 0)
            TextButton(
              onPressed: _markAllAsRead,
              child: Consumer<TenantProvider>(
                builder: (context, tenantProvider, _) {
                  return Text(
                    'Mark all read',
                    style: TextStyle(
                      color: tenantProvider.primaryColor,
                    ),
                  );
                },
              ),
            ),
        ],
      ),
      body: _isLoading
          ?  Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Builder(
                    builder: (context) =>  Text(
                      'Loading notifications...',
                      style: TextStyle(color: AppTheme.getTextSecondary(context)),
                    ),
                  ),
                ],
              ),
            )
          : SafeArea(
              child: Column(
                children: [
                  // Header Section
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16.0),
                    color: AppTheme.getCardBackground(context),
                    child: Consumer<TenantProvider>(
                      builder: (context, tenantProvider, _) {
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Stay Updated',
                              style: TextStyle(
                                fontSize: 28,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.getTextPrimary(context),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              unreadCount > 0
                                  ? '$unreadCount unread notification${unreadCount > 1 ? 's' : ''}'
                                  : 'You\'re all caught up!',
                              style: TextStyle(
                                fontSize: 16,
                                color: unreadCount > 0
                                    ? tenantProvider.primaryColor
                                    : AppTheme.getTextSecondary(context),
                                fontWeight: unreadCount > 0
                                    ? FontWeight.w600
                                    : FontWeight.normal,
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),

                  // Filter Chips
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16.0, vertical: 12),
                    color: AppTheme.getCardBackground(context),
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _buildFilterChip('All', 'all'),
                          const SizedBox(width: 8),
                          _buildFilterChip('Unread', 'unread', unreadCount),
                          const SizedBox(width: 8),
                          _buildFilterChip('Transactions', 'transactions'),
                          const SizedBox(width: 8),
                          _buildFilterChip('Alerts', 'alerts'),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Notifications List
                  Expanded(
                    child: _filteredNotifications.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.notifications_none,
                                  size: 80,
                                  color: AppTheme.getTextHint(context),
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  'No notifications',
                                  style: TextStyle(
                                    fontSize: 18,
                                    color: AppTheme.getTextSecondary(context),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'You\'re all caught up!',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: AppTheme.getTextHint(context),
                                  ),
                                ),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _loadNotifications,
                            child: ListView.builder(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16.0, vertical: 8),
                              itemCount: _filteredNotifications.length,
                              itemBuilder: (context, index) {
                                final notification =
                                    _filteredNotifications[index];
                                return _buildNotificationCard(notification);
                              },
                            ),
                          ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildFilterChip(String label, String value, [int? count]) {
    final isSelected = _selectedFilter == value;

    return Consumer<TenantProvider>(
      builder: (context, tenantProvider, _) {
        return FilterChip(
          label: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(label),
              if (count != null && count > 0) ...[
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? TenantUtils.getContrastingTextColor(tenantProvider.primaryColor)
                        : tenantProvider.primaryColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    count.toString(),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: isSelected
                          ? tenantProvider.primaryColor
                          : TenantUtils.getContrastingTextColor(tenantProvider.primaryColor),
                    ),
                  ),
                ),
              ],
            ],
          ),
          selected: isSelected,
          onSelected: (selected) {
            setState(() {
              _selectedFilter = value;
            });
          },
          backgroundColor: AppTheme.getCardBackground(context),
          selectedColor: tenantProvider.primaryColor,
          checkmarkColor: TenantUtils.getContrastingTextColor(tenantProvider.primaryColor),
          labelStyle: TextStyle(
            color: isSelected
                ? TenantUtils.getContrastingTextColor(tenantProvider.primaryColor)
                : AppTheme.getTextPrimary(context),
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
          ),
          side: BorderSide(
            color: isSelected
                ? tenantProvider.primaryColor
                : AppTheme.getBorderColor(context),
          ),
        );
      },
    );
  }

  Widget _buildNotificationCard(NotificationItem notification) {
    return Dismissible(
      key: Key(notification.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: AppTheme.errorColor,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Icon(
          Icons.delete_outline,
          color: Colors.white,
          size: 28,
        ),
      ),
      onDismissed: (direction) {
        _deleteNotification(notification.id);
      },
      child: GestureDetector(
        onTap: () {
          if (!notification.isRead) {
            _markAsRead(notification.id);
          }
          // Handle notification tap - navigate to relevant screen
        },
        child: Consumer<TenantProvider>(
          builder: (context, tenantProvider, _) {
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: notification.isRead
                    ? AppTheme.getCardBackground(context)
                    : Theme.of(context).scaffoldBackgroundColor,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: notification.isRead
                      ? AppTheme.getBorderColor(context)
                      : tenantProvider.primaryColor,
                  width: 1,
                ),
              ),
              child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Theme.of(context).scaffoldBackgroundColor,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: notification.iconColor,
                    width: 1,
                  ),
                ),
                child: Icon(
                  notification.icon,
                  color: notification.iconColor,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),

              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            notification.title,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: notification.isRead
                                  ? FontWeight.w600
                                  : FontWeight.bold,
                              color: AppTheme.getTextPrimary(context),
                            ),
                          ),
                        ),
                        if (!notification.isRead)
                          Consumer<TenantProvider>(
                            builder: (context, tenantProvider, _) {
                              return Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: tenantProvider.primaryColor,
                                  shape: BoxShape.circle,
                                ),
                              );
                            },
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      notification.message,
                      style: TextStyle(
                        fontSize: 14,
                        color: AppTheme.getTextSecondary(context),
                        height: 1.4,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _formatTimestamp(notification.timestamp),
                      style: TextStyle(
                        fontSize: 12,
                        color: AppTheme.getTextHint(context),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
            );
          },
        ),
      ),
    );
  }
}

enum NotificationType {
  transaction,
  alert,
  general,
}

class NotificationItem {
  final String id;
  final String title;
  final String message;
  final NotificationType type;
  bool isRead;
  final DateTime timestamp;
  final IconData icon;
  final Color iconColor;

  NotificationItem({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.isRead,
    required this.timestamp,
    required this.icon,
    required this.iconColor,
  });
}