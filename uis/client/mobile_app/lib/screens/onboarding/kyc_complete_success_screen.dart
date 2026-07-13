import 'package:flutter/material.dart';
import '../../../config/app_theme.dart';

class KycCompleteSuccessScreen extends StatefulWidget {
  const KycCompleteSuccessScreen({super.key});

  @override
  State<KycCompleteSuccessScreen> createState() => _KycCompleteSuccessScreenState();
}

class _KycCompleteSuccessScreenState extends State<KycCompleteSuccessScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    );
    _animationController.forward();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 60),

              // Success animation/icon
              Center(
                child: ScaleTransition(
                  scale: Tween(begin: 0.0, end: 1.0).animate(
                    CurvedAnimation(
                      parent: _animationController,
                      curve: Curves.elasticOut,
                    ),
                  ),
                  child: Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      color: Colors.green[50],
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.green[300]!,
                        width: 2,
                      ),
                    ),
                    child: Icon(
                      Icons.verified_user,
                      size: 80,
                      color: Colors.green[700],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 40),

              // Success message
              Text(
                'KYC Verification Complete!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.getTextPrimary(context),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Your account has been upgraded with full access',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  color: AppTheme.getTextSecondary(context),
                ),
              ),
              const SizedBox(height: 40),

              // Benefits unlocked
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.green[50]!, Colors.green[100]!],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.green[300]!),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.emoji_events, color: Colors.green[700]),
                        const SizedBox(width: 12),
                        Text(
                          'Benefits Unlocked',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.getTextPrimary(context),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _buildBenefitRow(Icons.arrow_upward, 'Increased transaction limits'),
                    _buildBenefitRow(Icons.money, 'Access to loans & credit'),
                    _buildBenefitRow(Icons.shield, 'Insurance products available'),
                    _buildBenefitRow(Icons.workspace_premium, 'Premium features unlocked'),
                  ],
                ),
              ),

              const Spacer(),

              // Return to dashboard button
              SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pushNamedAndRemoveUntil(
                      context,
                      '/dashboard',
                      (route) => false,
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('Go to Dashboard'),
                ),
              ),
              const SizedBox(height: 16),
              
              // View account info
              TextButton(
                onPressed: () {
                  Navigator.pushNamedAndRemoveUntil(
                    context,
                    '/settings',
                    (route) => route.isFirst,
                  );
                },
                child: const Text('View Account Settings'),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBenefitRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Icon(icon, size: 20, color: Colors.green[700]),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 14,
                color: AppTheme.getTextPrimary(context),
              ),
            ),
          ),
          Icon(Icons.check_circle, size: 20, color: Colors.green[600]),
        ],
      ),
    );
  }
}
