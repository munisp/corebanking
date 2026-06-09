import 'package:flutter/material.dart';

class CustomerFeedbackScreen extends StatefulWidget {
  const CustomerFeedbackScreen({super.key});
  @override
  State<CustomerFeedbackScreen> createState() => _CustomerFeedbackScreenState();
}

class _CustomerFeedbackScreenState extends State<CustomerFeedbackScreen> {
  int _rating = 0;
  String _category = 'General';
  final _feedbackController = TextEditingController();
  final List<Map<String, dynamic>> _recentFeedback = [
    {'user': 'Adebayo O.', 'rating': 5, 'category': 'Mobile App', 'text': 'Very fast transfers!', 'date': '2024-01-15'},
    {'user': 'Chidinma N.', 'rating': 3, 'category': 'Branch Service', 'text': 'Long queue at Ikeja branch', 'date': '2024-01-14'},
    {'user': 'Emeka W.', 'rating': 4, 'category': 'Card Services', 'text': 'Quick card replacement', 'date': '2024-01-13'},
    {'user': 'Fatima A.', 'rating': 1, 'category': 'ATM', 'text': 'ATM dispensed wrong amount at VI', 'date': '2024-01-12'},
    {'user': 'Gbenga Y.', 'rating': 5, 'category': 'Internet Banking', 'text': 'Love the new statement feature', 'date': '2024-01-11'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Customer Feedback')),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Rate Your Experience', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: List.generate(5, (i) =>
            IconButton(icon: Icon(i < _rating ? Icons.star : Icons.star_border, size: 40, color: Colors.amber),
              onPressed: () => setState(() => _rating = i + 1)))),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(value: _category, decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder()),
            items: ['General', 'Mobile App', 'Internet Banking', 'Branch Service', 'ATM', 'Card Services', 'Loan', 'Customer Support']
              .map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
            onChanged: (v) => setState(() => _category = v!)),
          const SizedBox(height: 12),
          TextField(controller: _feedbackController, maxLines: 4, decoration: const InputDecoration(labelText: 'Your Feedback', border: OutlineInputBorder(), hintText: 'Tell us about your experience...')),
          const SizedBox(height: 12),
          SizedBox(width: double.infinity, child: ElevatedButton(onPressed: _rating > 0 ? () {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Thank you for your feedback!')));
            setState(() { _rating = 0; _feedbackController.clear(); });
          } : null, child: const Text('Submit Feedback'))),
        ]))),
        const SizedBox(height: 16),
        const Text('Recent Feedback', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        ...(_recentFeedback.map((f) => Card(child: ListTile(
          leading: CircleAvatar(backgroundColor: _ratingColor(f['rating'] as int), child: Text('${f["rating"]}', style: const TextStyle(color: Colors.white))),
          title: Text('${f["user"]} - ${f["category"]}'),
          subtitle: Text(f['text'] as String),
          trailing: Text(f['date'] as String, style: const TextStyle(fontSize: 12, color: Colors.grey)),
        )))),
      ])),
    );
  }

  Color _ratingColor(int rating) {
    if (rating >= 4) return Colors.green;
    if (rating >= 3) return Colors.orange;
    return Colors.red;
  }
}
