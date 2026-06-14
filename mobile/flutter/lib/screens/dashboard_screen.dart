import 'package:flutter/material.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _balanceVisible = true;
  final String _accountName = 'Adewale Okafor';
  final String _accountNumber = '0123456789';
  final int _balanceKobo = 285043500; // ₦2,850,435.00 in kobo

  String _formatNaira(int kobo) {
    final naira = kobo ~/ 100;
    final k = kobo % 100;
    final parts = <String>[];
    var n = naira;
    while (n >= 1000) { parts.insert(0, (n % 1000).toString().padLeft(3, '0')); n ~/= 1000; }
    parts.insert(0, n.toString());
    return '₦\${parts.join(",")}.${k.toString().padLeft(2, "0")}';
  }

  Widget _quickAction(String label, IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Colors.green[50], borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: Colors.green[700], size: 28),
        ),
        const SizedBox(height: 6),
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
      ]),
    );
  }

  Widget _txnTile(String title, String amount, String date, IconData icon, bool isCredit) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: isCredit ? Colors.green[50] : Colors.red[50],
        child: Icon(icon, color: isCredit ? Colors.green[700] : Colors.red[700], size: 20),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w500)),
      subtitle: Text(date, style: TextStyle(fontSize: 12, color: Colors.grey[500])),
      trailing: Text(amount,
        style: TextStyle(fontWeight: FontWeight.bold, color: isCredit ? Colors.green[700] : Colors.red[700])),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Hello, ${_accountName.split(" ").first}', style: const TextStyle(fontSize: 14)),
          Text(_accountNumber, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w300)),
        ]),
        backgroundColor: Colors.green[700],
        actions: [
          IconButton(icon: const Icon(Icons.notifications_outlined), onPressed: () => Navigator.pushNamed(context, '/notifications')),
          IconButton(icon: const Icon(Icons.person_outline), onPressed: () => Navigator.pushNamed(context, '/profile')),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.green[700],
              borderRadius: const BorderRadius.vertical(bottom: Radius.circular(24)),
            ),
            child: Column(children: [
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text('Available Balance', style: TextStyle(color: Colors.green[100], fontSize: 14)),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => setState(() => _balanceVisible = !_balanceVisible),
                  child: Icon(_balanceVisible ? Icons.visibility : Icons.visibility_off,
                    color: Colors.green[100], size: 18),
                ),
              ]),
              const SizedBox(height: 8),
              Text(
                _balanceVisible ? _formatNaira(_balanceKobo) : '₦ ****',
                style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
              _quickAction('Transfer', Icons.send, () => Navigator.pushNamed(context, '/transfer')),
              _quickAction('Bills', Icons.receipt_long, () => Navigator.pushNamed(context, '/bill-payment')),
              _quickAction('Cards', Icons.credit_card, () => Navigator.pushNamed(context, '/card-management')),
              _quickAction('Loans', Icons.account_balance_wallet, () => Navigator.pushNamed(context, '/loans')),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Card(child: Column(children: [
              const ListTile(title: Text('Recent Transactions', style: TextStyle(fontWeight: FontWeight.bold))),
              _txnTile('NIP Transfer to Chioma', '-₦150,000.00', 'Today 14:32', Icons.arrow_upward, false),
              _txnTile('Salary Credit', '+₦850,000.00', 'Jun 1, 09:00', Icons.arrow_downward, true),
              _txnTile('DSTV Subscription', '-₦24,500.00', 'May 30, 11:15', Icons.tv, false),
              _txnTile('POS Purchase', '-₦12,300.00', 'May 29, 16:45', Icons.point_of_sale, false),
              _txnTile('Transfer from Emeka', '+₦500,000.00', 'May 28, 08:20', Icons.arrow_downward, true),
              TextButton(onPressed: () => Navigator.pushNamed(context, '/statements'),
                child: Text('View All Transactions', style: TextStyle(color: Colors.green[700]))),
            ])),
          ),
        ]),
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        selectedItemColor: Colors.green[700],
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.swap_horiz), label: 'Transfers'),
          BottomNavigationBarItem(icon: Icon(Icons.qr_code_scanner), label: 'Scan'),
          BottomNavigationBarItem(icon: Icon(Icons.savings), label: 'Save'),
          BottomNavigationBarItem(icon: Icon(Icons.more_horiz), label: 'More'),
        ],
      ),
    );
  }
}
