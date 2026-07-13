import 'package:flutter/material.dart';

class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final options = [
      {'title': 'Chat with support', 'icon': Icons.chat_bubble_outline},
      {'title': 'Call hotline', 'icon': Icons.phone_in_talk_outlined},
      {'title': 'Email support', 'icon': Icons.mail_outline},
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Support')),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: options.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final item = options[index];
          return Card(
            child: ListTile(
              leading: Icon(item['icon'] as IconData),
              title: Text(item['title'] as String),
              subtitle: Text(_getSupportSubtitle(item['title'] as String)),
              onTap: () => _handleSupportAction(context, item['title'] as String),
            ),
          );
        },
      ),
    );
  }

  String _getSupportSubtitle(String title) {
    switch (title) {
      case 'Chat with support':
        return 'Get instant help via chat';
      case 'Call hotline':
        return 'Speak with our support team';
      case 'Email support':
        return 'Send us an email';
      default:
        return '';
    }
  }

  void _handleSupportAction(BuildContext context, String action) {
    // - Chat: Open chat interface or redirect to chat app
    // - Call: Use url_launcher to make phone call
    // - Email: Use url_launcher to open email client
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$action functionality coming soon')),
    );
  }
}
