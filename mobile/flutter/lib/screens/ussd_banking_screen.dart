import 'package:flutter/material.dart';

/// USSD Banking Simulator — *919*amount*account# format for offline transactions
class UssdBankingScreen extends StatefulWidget {
  const UssdBankingScreen({super.key});
  @override
  State<UssdBankingScreen> createState() => _UssdBankingScreenState();
}

class _UssdBankingScreenState extends State<UssdBankingScreen> {
  final _ussdController = TextEditingController();
  String _currentMenu = 'main';
  List<String> _menuHistory = [];
  String _response = '';
  bool _isProcessing = false;

  // USSD menu tree
  final _menus = {
    'main': {'title': 'Welcome to 54Bank', 'options': ['1. Transfer Money', '2. Buy Airtime', '3. Pay Bills', '4. Check Balance', '5. Mini Statement', '6. Block Card', '0. Exit']},
    'transfer': {'title': 'Transfer Money', 'options': ['1. To 54Bank Account', '2. To Other Banks', '3. To Phone Number', '0. Back']},
    'airtime': {'title': 'Buy Airtime', 'options': ['1. Self', '2. Others', '0. Back']},
    'bills': {'title': 'Pay Bills', 'options': ['1. Electricity (PHCN)', '2. Cable TV (DSTV/GOtv)', '3. Internet', '4. Water', '0. Back']},
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('USSD Banking'), backgroundColor: Colors.black),
      backgroundColor: Colors.grey.shade900,
      body: Column(
        children: [
          // USSD code display
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            color: Colors.black,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Dial: *919#', style: TextStyle(color: Colors.green, fontSize: 20, fontFamily: 'monospace')),
                const SizedBox(height: 4),
                Text('Quick codes:', style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
                Text('*919*1*amount*account# — Transfer', style: TextStyle(color: Colors.grey.shade500, fontSize: 11, fontFamily: 'monospace')),
                Text('*919*amount# — Airtime Self', style: TextStyle(color: Colors.grey.shade500, fontSize: 11, fontFamily: 'monospace')),
              ],
            ),
          ),
          // Menu display (simulated phone screen)
          Expanded(
            child: Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black,
                border: Border.all(color: Colors.green.withOpacity(0.3)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_response.isNotEmpty) ...[
                    Text(_response, style: const TextStyle(color: Colors.green, fontFamily: 'monospace', fontSize: 14)),
                  ] else ...[
                    Text(_menus[_currentMenu]!['title'] as String,
                        style: const TextStyle(color: Colors.green, fontFamily: 'monospace', fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    ...(_menus[_currentMenu]!['options'] as List<String>).map((opt) =>
                        Padding(padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Text(opt, style: const TextStyle(color: Colors.green, fontFamily: 'monospace', fontSize: 14)))),
                  ],
                ],
              ),
            ),
          ),
          // Input
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.black,
            child: Row(
              children: [
                Expanded(child: TextField(
                  controller: _ussdController,
                  style: const TextStyle(color: Colors.green, fontFamily: 'monospace', fontSize: 18),
                  decoration: InputDecoration(
                    hintText: 'Enter option...',
                    hintStyle: TextStyle(color: Colors.green.withOpacity(0.3)),
                    border: OutlineInputBorder(borderSide: const BorderSide(color: Colors.green)),
                    focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Colors.green)),
                  ),
                  keyboardType: TextInputType.number,
                )),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _isProcessing ? null : _processInput,
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.green, padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16)),
                  child: _isProcessing ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                      : const Text('Send', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _processInput() {
    final input = _ussdController.text.trim();
    if (input.isEmpty) return;
    _ussdController.clear();

    setState(() => _isProcessing = true);
    Future.delayed(const Duration(milliseconds: 500), () {
      setState(() {
        _isProcessing = false;
        if (input == '0') {
          if (_menuHistory.isNotEmpty) { _currentMenu = _menuHistory.removeLast(); _response = ''; }
          else { _response = 'Thank you for banking with 54Bank!'; }
        } else if (_currentMenu == 'main') {
          _menuHistory.add(_currentMenu);
          switch (input) {
            case '1': _currentMenu = 'transfer'; _response = ''; break;
            case '2': _currentMenu = 'airtime'; _response = ''; break;
            case '3': _currentMenu = 'bills'; _response = ''; break;
            case '4': _response = 'Your balance is:\nSavings: NGN 1,250,000.00\nCurrent: NGN 3,450,000.00\n\n0. Back'; break;
            case '5': _response = 'Mini Statement (Last 5):\n09/06 -NGN50,000 Transfer\n09/06 +NGN1,500,000 Salary\n08/06 -NGN29,500 DSTV\n07/06 -NGN5,000 Airtime\n06/06 -NGN150,000 Transfer\n\n0. Back'; break;
            case '6': _response = 'Card blocked successfully.\nVisit any branch to unblock.\nRef: BLK-20260609-001\n\n0. Back'; break;
            default: _response = 'Invalid option. Try again.\n\n0. Back';
          }
        } else {
          _response = 'Processing...\nTransaction successful!\nRef: USSD-${DateTime.now().millisecondsSinceEpoch}\nAmount: NGN $input\n\n0. Main Menu';
          _menuHistory.clear();
          _currentMenu = 'main';
        }
      });
    });
  }
}
