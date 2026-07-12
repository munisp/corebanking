import 'package:flutter/material.dart';

class BvnScreen extends StatefulWidget {
  const BvnScreen({super.key});

  @override
  State<BvnScreen> createState() => _BvnScreenState();
}

class _BvnScreenState extends State<BvnScreen> {
  final _controller = TextEditingController();
  bool _loading = false;

  Future<void> _submit() async {
    if (_controller.text.length != 11) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter valid 11-digit BVN')),
      );
      return;
    }
    setState(() => _loading = true);
    try {
      // final apiService = ApiService();
      // final response = await apiService.post('/kyc/verify-bvn', data: {'bvn': _controller.text});
      // if (response.data['verified'] == true) {
      //   // Proceed to PIN creation
      // }
      
      // Simulated API call - remove when real API is implemented
      await Future.delayed(const Duration(milliseconds: 600));
      
      if (!mounted) return;
      setState(() => _loading = false);
      Navigator.pushReplacementNamed(context, '/create-pin');
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('BVN verification failed: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('BVN Verification')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              controller: _controller,
              decoration: InputDecoration(
                labelText: 'BVN',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              keyboardType: TextInputType.number,
              maxLength: 11,
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Verify'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
