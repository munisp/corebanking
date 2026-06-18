import 'package:flutter/material.dart';

class LoansScreen extends StatefulWidget {
  const LoansScreen({super.key});
  @override
  State<LoansScreen> createState() => _LoansScreenState();
}

class _LoansScreenState extends State<LoansScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _formKey = GlobalKey<FormState>();
  double _loanAmount = 100000;
  int _tenureMonths = 12;
  double _interestRate = 18.5;
  String _selectedProduct = 'personal';
  bool _isSubmitting = false;

  final _bvnController = TextEditingController();
  final _ninController = TextEditingController();
  final _employerController = TextEditingController();
  final _salaryController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _bvnController.dispose();
    _ninController.dispose();
    _employerController.dispose();
    _salaryController.dispose();
    super.dispose();
  }

  double get _monthlyPayment {
    double r = _interestRate / 100 / 12;
    int n = _tenureMonths;
    if (r == 0) return _loanAmount / n;
    return _loanAmount * r * _pow(1 + r, n) / (_pow(1 + r, n) - 1);
  }

  double _pow(double base, int exp) {
    double result = 1;
    for (int i = 0; i < exp; i++) result *= base;
    return result;
  }

  double get _totalRepayment => _monthlyPayment * _tenureMonths;
  double get _totalInterest => _totalRepayment - _loanAmount;

  String _formatNGN(double amount) => 'NGN ${amount.toStringAsFixed(0).replaceAllMapped(RegExp(r"(\d)(?=(\d{3})+(?!\d))"), (m) => "${m[1]},")}';

  bool _validateBVN(String? v) {
    if (v == null || v.isEmpty) return false;
    if (v.length != 11) return false;
    return RegExp(r'^[0-9]{11}\$').hasMatch(v);
  }

  bool _validateNIN(String? v) {
    if (v == null || v.isEmpty) return false;
    if (v.length != 11) return false;
    return RegExp(r'^[0-9]{11}\$').hasMatch(v);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Loans'),
        bottom: TabBar(controller: _tabController, tabs: const [
          Tab(icon: Icon(Icons.calculate), text: 'Calculator'),
          Tab(icon: Icon(Icons.description), text: 'Apply'),
          Tab(icon: Icon(Icons.list_alt), text: 'My Loans'),
        ]),
      ),
      body: TabBarView(controller: _tabController, children: [
        _buildCalculator(),
        _buildApplication(),
        _buildMyLoans(),
      ]),
    );
  }

  Widget _buildCalculator() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Loan Calculator', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _selectedProduct,
              decoration: const InputDecoration(labelText: 'Loan Product', border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'personal', child: Text('Personal Loan (18.5%)')),
                DropdownMenuItem(value: 'agriculture', child: Text('Agriculture Loan (9.0%)')),
                DropdownMenuItem(value: 'education', child: Text('Education Loan (12.0%)')),
                DropdownMenuItem(value: 'mortgage', child: Text('Mortgage (15.5%)')),
                DropdownMenuItem(value: 'sme', child: Text('SME Loan (16.0%)')),
              ],
              onChanged: (v) => setState(() {
                _selectedProduct = v!;
                _interestRate = {'personal': 18.5, 'agriculture': 9.0, 'education': 12.0, 'mortgage': 15.5, 'sme': 16.0}[v] ?? 18.5;
              }),
            ),
            const SizedBox(height: 16),
            Text('Loan Amount: ${_formatNGN(_loanAmount)}'),
            Slider(min: 10000, max: 10000000, divisions: 100, value: _loanAmount,
              label: _formatNGN(_loanAmount),
              onChanged: (v) => setState(() => _loanAmount = v)),
            const SizedBox(height: 8),
            Text('Tenure: $_tenureMonths months'),
            Slider(min: 3, max: 72, divisions: 69, value: _tenureMonths.toDouble(),
              label: '$_tenureMonths months',
              onChanged: (v) => setState(() => _tenureMonths = v.round())),
          ],
        ))),
        const SizedBox(height: 16),
        Card(color: Theme.of(context).colorScheme.primaryContainer, child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            _resultRow('Monthly Payment', _formatNGN(_monthlyPayment)),
            const Divider(),
            _resultRow('Total Repayment', _formatNGN(_totalRepayment)),
            _resultRow('Total Interest', _formatNGN(_totalInterest)),
            _resultRow('Interest Rate', '${_interestRate.toStringAsFixed(1)}% p.a.'),
          ]),
        )),
        const SizedBox(height: 16),
        SizedBox(width: double.infinity, child: ElevatedButton.icon(
          icon: const Icon(Icons.arrow_forward),
          label: const Text('Proceed to Apply'),
          onPressed: () => _tabController.animateTo(1),
        )),
      ]),
    );
  }

  Widget _resultRow(String label, String value) {
    return Padding(padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label), Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
      ]));
  }

  Widget _buildApplication() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(key: _formKey, child: Column(children: [
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Identity Verification', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextFormField(
              controller: _bvnController,
              decoration: const InputDecoration(labelText: 'BVN (11 digits)', prefixIcon: Icon(Icons.fingerprint), border: OutlineInputBorder()),
              keyboardType: TextInputType.number, maxLength: 11,
              validator: (v) => _validateBVN(v) ? null : 'Invalid BVN (must be 11 digits)',
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _ninController,
              decoration: const InputDecoration(labelText: 'NIN (11 digits)', prefixIcon: Icon(Icons.badge), border: OutlineInputBorder()),
              keyboardType: TextInputType.number, maxLength: 11,
              validator: (v) => _validateNIN(v) ? null : 'Invalid NIN (must be 11 digits)',
            ),
          ],
        ))),
        const SizedBox(height: 12),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Employment Details', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextFormField(
              controller: _employerController,
              decoration: const InputDecoration(labelText: 'Employer Name', prefixIcon: Icon(Icons.business), border: OutlineInputBorder()),
              validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _salaryController,
              decoration: const InputDecoration(labelText: 'Monthly Salary (NGN)', prefixIcon: Icon(Icons.payments), border: OutlineInputBorder()),
              keyboardType: TextInputType.number,
              validator: (v) {
                if (v == null || v.isEmpty) return 'Required';
                final salary = double.tryParse(v);
                if (salary == null || salary < 30000) return 'Minimum NGN 30,000';
                return null;
              },
            ),
          ],
        ))),
        const SizedBox(height: 16),
        SizedBox(width: double.infinity, child: ElevatedButton.icon(
          icon: _isSubmitting ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.send),
          label: Text(_isSubmitting ? 'Submitting...' : 'Submit Application'),
          onPressed: _isSubmitting ? null : () async {
            if (_formKey.currentState!.validate()) {
              setState(() => _isSubmitting = true);
              await Future.delayed(const Duration(seconds: 2));
              setState(() => _isSubmitting = false);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Loan application submitted successfully!'), backgroundColor: Colors.green));
                _tabController.animateTo(2);
              }
            }
          },
        )),
      ])),
    );
  }

  Widget _buildMyLoans() {
    final loans = [
      {'id': 'LN-2024-001', 'product': 'Personal Loan', 'amount': 'NGN 500,000', 'status': 'Active', 'nextPayment': 'Jul 15, 2024', 'balance': 'NGN 312,500'},
      {'id': 'LN-2024-002', 'product': 'Education Loan', 'amount': 'NGN 1,200,000', 'status': 'Active', 'nextPayment': 'Jul 20, 2024', 'balance': 'NGN 890,000'},
      {'id': 'LN-2023-015', 'product': 'Agriculture Loan', 'amount': 'NGN 200,000', 'status': 'Paid Off', 'nextPayment': '-', 'balance': 'NGN 0'},
    ];
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: loans.length,
      itemBuilder: (ctx, i) {
        final loan = loans[i];
        final isPaid = loan['status'] == 'Paid Off';
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: isPaid ? Colors.green.shade100 : Colors.blue.shade100,
              child: Icon(isPaid ? Icons.check_circle : Icons.account_balance, color: isPaid ? Colors.green : Colors.blue),
            ),
            title: Text(loan['product']!),
            subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${loan["id"]} • ${loan["amount"]}'),
              if (!isPaid) Text('Next: ${loan["nextPayment"]} • Balance: ${loan["balance"]}'),
            ]),
            trailing: Chip(label: Text(loan['status']!, style: TextStyle(color: isPaid ? Colors.green : Colors.blue, fontSize: 12)),
              backgroundColor: isPaid ? Colors.green.shade50 : Colors.blue.shade50),
          ),
        );
      },
    );
  }
}
