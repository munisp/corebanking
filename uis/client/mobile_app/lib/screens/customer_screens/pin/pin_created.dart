import 'package:flutter/material.dart';

class PinSuccessScreen extends StatefulWidget {
  final bool isOnboarding; // True if coming from onboarding flow

  const PinSuccessScreen({super.key, this.isOnboarding = false});

  @override
  State<PinSuccessScreen> createState() => _PinSuccessScreenState();
}

class _PinSuccessScreenState extends State<PinSuccessScreen> 
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _scaleAnimation;
  late Animation<double> _fadeAnimation;
  late Animation<double> _checkmarkAnimation;

  @override
  void initState() {
    super.initState();
    
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    );

    _scaleAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.0, 0.5, curve: Curves.elasticOut),
      ),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.3, 0.7, curve: Curves.easeIn),
      ),
    );

    _checkmarkAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.5, 0.9, curve: Curves.easeOut),
      ),
    );

    _animationController.forward();

    // Auto-navigate after 3 seconds
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) {
        if (widget.isOnboarding) {
          // During onboarding, navigate to login
          Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
        } else {
          // Regular flow, navigate to dashboard
          Navigator.pushReplacementNamed(context, '/dashboard');
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              
              // Animated success icon
              Center(
                child: AnimatedBuilder(
                  animation: _animationController,
                  builder: (context, child) {
                    return Transform.scale(
                      scale: _scaleAnimation.value,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          // Outer ring with pulse effect
                          Container(
                            width: 160,
                            height: 160,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.green[50],
                              border: Border.all(
                                color: Colors.green[200]!,
                                width: 2,
                              ),
                            ),
                          ),
                          
                          // Middle ring
                          Container(
                            width: 130,
                            height: 130,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.green[100],
                            ),
                          ),
                          
                          // Inner circle with icon
                          Container(
                            width: 100,
                            height: 100,
                            decoration: BoxDecoration(
                              color: Colors.green[600],
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.green[600]!.withOpacity(0.4),
                                  blurRadius: 20,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            child: CustomPaint(
                              painter: CheckmarkPainter(
                                progress: _checkmarkAnimation.value,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              
              const SizedBox(height: 48),
              
              // Success text with fade animation
              AnimatedBuilder(
                animation: _fadeAnimation,
                builder: (context, child) {
                  return Opacity(
                    opacity: _fadeAnimation.value,
                    child: Column(
                      children: [
                        Text(
                          widget.isOnboarding
                              ? 'Account Created Successfully!'
                              : 'PIN Created Successfully!',
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        
                        const SizedBox(height: 16),
                        
                        Text(
                          widget.isOnboarding
                              ? 'Your account has been created and your PIN has been set up. Please login to continue.'
                              : 'Your 4-digit PIN has been set up successfully. You can now use it for quick and secure access to your account.',
                          style: TextStyle(
                            fontSize: 15,
                            color: Colors.grey[600],
                            height: 1.5,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  );
                },
              ),
              
              const SizedBox(height: 48),
              
              // Security features
              AnimatedBuilder(
                animation: _fadeAnimation,
                builder: (context, child) {
                  return Opacity(
                    opacity: _fadeAnimation.value,
                    child: Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.blue[50],
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.blue[100]!, width: 1),
                      ),
                      child: Column(
                        children: [
                          _buildFeatureItem(
                            Icons.security,
                            'Secure Access',
                            'Your PIN is encrypted and stored securely',
                          ),
                          const SizedBox(height: 16),
                          _buildFeatureItem(
                            Icons.speed,
                            'Quick Login',
                            'Access your account faster with PIN',
                          ),
                          const SizedBox(height: 16),
                          _buildFeatureItem(
                            Icons.lock_person,
                            'Privacy Protected',
                            'Only you know your PIN code',
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              
              const Spacer(),
              
              // Continue button
              AnimatedBuilder(
                animation: _fadeAnimation,
                builder: (context, child) {
                  return Opacity(
                    opacity: _fadeAnimation.value,
                    child: Column(
                      children: [
                        SizedBox(
                          height: 56,
                          child: ElevatedButton(
                            onPressed: () {
                              if (widget.isOnboarding) {
                                // During onboarding, navigate to login
                                Navigator.pushNamedAndRemoveUntil(
                                  context,
                                  '/login',
                                  (route) => false,
                                );
                              } else {
                                // Regular flow, navigate to dashboard
                                Navigator.pushReplacementNamed(context, '/dashboard');
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.blue[700],
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              elevation: 2,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  widget.isOnboarding
                                      ? 'Go to Login'
                                      : 'Continue to Dashboard',
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Icon(
                                  widget.isOnboarding
                                      ? Icons.login
                                      : Icons.arrow_forward,
                                  size: 20,
                                ),
                              ],
                            ),
                          ),
                        ),
                        
                        const SizedBox(height: 12),
                        
                        Text(
                          widget.isOnboarding
                              ? 'Redirecting to login in a moment...'
                              : 'Redirecting automatically in a moment...',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey[500],
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  );
                },
              ),
              
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFeatureItem(IconData icon, String title, String description) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: Colors.blue[100],
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            icon,
            color: Colors.blue[700],
            size: 22,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[800],
                ),
              ),
              const SizedBox(height: 4),
              Text(
                description,
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey[600],
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }
}

// Custom painter for animated checkmark
class CheckmarkPainter extends CustomPainter {
  final double progress;

  CheckmarkPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..strokeWidth = 4.0
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    final centerX = size.width / 2;
    final centerY = size.height / 2;

    // Checkmark path
    final path = Path();
    
    // Starting point (left point of checkmark)
    final startX = centerX - 15;
    final startY = centerY;
    
    // Middle point (bottom of checkmark)
    final midX = centerX - 5;
    final midY = centerY + 12;
    
    // End point (top right of checkmark)
    final endX = centerX + 18;
    final endY = centerY - 12;

    path.moveTo(startX, startY);

    if (progress <= 0.5) {
      // First half: draw from start to middle
      final currentProgress = progress * 2;
      final currentX = startX + (midX - startX) * currentProgress;
      final currentY = startY + (midY - startY) * currentProgress;
      path.lineTo(currentX, currentY);
    } else {
      // Second half: draw from middle to end
      path.lineTo(midX, midY);
      final currentProgress = (progress - 0.5) * 2;
      final currentX = midX + (endX - midX) * currentProgress;
      final currentY = midY + (endY - midY) * currentProgress;
      path.lineTo(currentX, currentY);
    }

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(CheckmarkPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}