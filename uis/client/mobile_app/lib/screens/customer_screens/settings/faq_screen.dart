import 'package:flutter/material.dart';

class FaqScreen extends StatelessWidget {
  const FaqScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // final apiService = ApiService();
    // final response = await apiService.get('/support/faqs');
    // final faqs = response.data['data'] ?? [];
    
    final faqs = [
      {'q': 'How do I reset my password?', 'a': 'Use Forgot Password, then follow the email link.'},
      {'q': 'How do I create a PIN?', 'a': 'Go to Settings > Security > Create PIN to set up your transaction PIN.'},
      {'q': 'Is my data secure?', 'a': 'Yes, we use industry-standard encryption and security measures to protect your data.'},
      {'q': 'How do I check the status of banking services?', 'a': 'Go to Settings > Network Status to view the real-time status of all major services.'},
      {'q': 'How do I contact support?', 'a': 'Go to Settings > Support to chat with our support team or send an email.'},
      {'q': 'How do I update my profile information?', 'a': 'Go to Settings > Account > Complete Profile to update your personal details.'},
      {'q': 'How do I enable biometric login?', 'a': 'Go to Settings > Security and toggle on biometric authentication.'},
      {'q': 'How do I view my transaction history?', 'a': 'Go to the Dashboard and select the Transactions tab to see your recent activity.'},
      {'q': 'What should I do if a transaction fails?', 'a': 'If a transaction fails, check your network connection and try again. If the issue persists, contact support.'},
      {'q': 'How do I apply for a loan?', 'a': 'Navigate to the Loans section from the main menu and follow the application steps.'},
      {'q': 'How do I report a dispute?', 'a': 'Go to the Disputes section from the main menu and fill out the dispute form for the relevant transaction.'},
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('FAQ')),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: faqs.length,
        itemBuilder: (context, index) {
          final item = faqs[index];
          return Card(
            child: ExpansionTile(
              title: Text(item['q'] as String),
              children: [
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Text(item['a'] as String),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
