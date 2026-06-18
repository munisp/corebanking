import 'package:flutter/material.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  int _currentStep = 0;

  final List<Map<String, dynamic>> _steps = [
    {
      'title': 'Welcome to 54Bank',
      'subtitle': 'Nigeria\'s most innovative digital banking platform',
      'icon': Icons.account_balance,
      'color': Colors.green,
    },
    {
      'title': 'Secure & Compliant',
      'subtitle': 'CBN-licensed, NDPR-compliant, PCI-DSS certified',
      'icon': Icons.shield,
      'color': Colors.blue,
    },
    {
      'title': 'Open an Account in Minutes',
      'subtitle': 'BVN/NIN verification, biometric authentication, instant KYC',
      'icon': Icons.speed,
      'color': Colors.orange,
    },
    {
      'title': 'Send Money Instantly',
      'subtitle': 'NIP transfers, bill payments, QR payments, USSD banking',
      'icon': Icons.send,
      'color': Colors.purple,
    },
  ];

  void _nextStep() {
    if (_currentStep < _steps.length - 1) {
      setState(() => _currentStep++);
    } else {
      Navigator.pushReplacementNamed(context, '/account-opening');
    }
  }

  @override
  Widget build(BuildContext context) {
    final step = _steps[_currentStep];
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Spacer(),
              Icon(step['icon'] as IconData, size: 120, color: (step['color'] as Color).withOpacity(0.8)),
              const SizedBox(height: 32),
              Text(step['title'] as String,
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center),
              const SizedBox(height: 12),
              Text(step['subtitle'] as String,
                style: TextStyle(fontSize: 16, color: Colors.grey[600]),
                textAlign: TextAlign.center),
              const Spacer(),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(_steps.length, (i) => Container(
                  width: i == _currentStep ? 24 : 8,
                  height: 8,
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(4),
                    color: i == _currentStep ? Colors.green[700] : Colors.grey[300],
                  ),
                )),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _nextStep,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green[700],
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(
                    _currentStep < _steps.length - 1 ? 'Next' : 'Get Started',
                    style: const TextStyle(fontSize: 18, color: Colors.white),
                  ),
                ),
              ),
              if (_currentStep < _steps.length - 1)
                TextButton(
                  onPressed: () => Navigator.pushReplacementNamed(context, '/account-opening'),
                  child: Text('Skip', style: TextStyle(color: Colors.grey[600])),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
