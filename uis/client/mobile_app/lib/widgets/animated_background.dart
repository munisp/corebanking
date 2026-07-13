import 'package:flutter/material.dart';
import 'dart:math' as math;

/// Premium animated background for auth screens
class AnimatedBackground extends StatefulWidget {
  final Widget child;
  final Color primaryColor;
  final bool showBuildings;

  const AnimatedBackground({
    super.key,
    required this.child,
    required this.primaryColor,
    this.showBuildings = true,
  });

  @override
  State<AnimatedBackground> createState() => _AnimatedBackgroundState();
}

class _AnimatedBackgroundState extends State<AnimatedBackground>
    with TickerProviderStateMixin {
  late AnimationController _floatingController;
  late AnimationController _shimmerController;

  @override
  void initState() {
    super.initState();
    _floatingController = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
    )..repeat(reverse: true);

    _shimmerController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _floatingController.dispose();
    _shimmerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Gradient background
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                widget.primaryColor.withOpacity(0.05),
                widget.primaryColor.withOpacity(0.02),
                Colors.white,
              ],
            ),
          ),
        ),

        // Animated circles
        ...List.generate(3, (index) {
          return AnimatedBuilder(
            animation: _floatingController,
            builder: (context, child) {
              final offset = math.sin(_floatingController.value * 2 * math.pi);
              return Positioned(
                top: 100 + (index * 200) + (offset * 20),
                right: -100 + (index * 50),
                child: Container(
                  width: 200 + (index * 50),
                  height: 200 + (index * 50),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        widget.primaryColor.withOpacity(0.03),
                        widget.primaryColor.withOpacity(0.01),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              );
            },
          );
        }),

        // SVG-style buildings (drawn with CustomPainter)
        if (widget.showBuildings)
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: AnimatedBuilder(
              animation: _shimmerController,
              builder: (context, child) {
                return CustomPaint(
                  size: Size(MediaQuery.of(context).size.width, 200),
                  painter: BuildingsPainter(
                    primaryColor: widget.primaryColor,
                    shimmerValue: _shimmerController.value,
                  ),
                );
              },
            ),
          ),

        // Content
        widget.child,
      ],
    );
  }
}

class BuildingsPainter extends CustomPainter {
  final Color primaryColor;
  final double shimmerValue;

  BuildingsPainter({required this.primaryColor, required this.shimmerValue});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = primaryColor.withOpacity(0.08)
      ..style = PaintingStyle.fill;

    final random = math.Random(42); // Fixed seed for consistency

    // Draw multiple buildings
    for (int i = 0; i < 8; i++) {
      final width = 40 + random.nextDouble() * 60;
      final height = 80 + random.nextDouble() * 120;
      final x = (size.width / 8) * i + random.nextDouble() * 20;
      final y = size.height - height;

      // Building body
      final buildingRect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, y, width, height),
        const Radius.circular(8),
      );
      canvas.drawRRect(buildingRect, paint);

      // Windows with shimmer effect
      final windowPaint = Paint()
        ..color = primaryColor.withOpacity(0.15 + (shimmerValue * 0.1))
        ..style = PaintingStyle.fill;

      final rows = (height / 20).floor();
      final cols = (width / 15).floor();

      for (int row = 0; row < rows; row++) {
        for (int col = 0; col < cols; col++) {
          if (random.nextDouble() > 0.3) {
            final windowX = x + 5 + (col * 15);
            final windowY = y + 10 + (row * 20);
            canvas.drawRRect(
              RRect.fromRectAndRadius(
                Rect.fromLTWH(windowX, windowY, 8, 12),
                const Radius.circular(2),
              ),
              windowPaint,
            );
          }
        }
      }
    }
  }

  @override
  bool shouldRepaint(BuildingsPainter oldDelegate) {
    return oldDelegate.shimmerValue != shimmerValue;
  }
}

/// Floating particles animation
class FloatingParticles extends StatefulWidget {
  final Color color;
  final int particleCount;

  const FloatingParticles({
    super.key,
    required this.color,
    this.particleCount = 15,
  });

  @override
  State<FloatingParticles> createState() => _FloatingParticlesState();
}

class _FloatingParticlesState extends State<FloatingParticles>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(seconds: 20),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return CustomPaint(
          size: MediaQuery.of(context).size,
          painter: ParticlesPainter(
            animationValue: _controller.value,
            color: widget.color,
            particleCount: widget.particleCount,
          ),
        );
      },
    );
  }
}

class ParticlesPainter extends CustomPainter {
  final double animationValue;
  final Color color;
  final int particleCount;

  ParticlesPainter({
    required this.animationValue,
    required this.color,
    required this.particleCount,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color.withOpacity(0.3)
      ..style = PaintingStyle.fill;

    final random = math.Random(42);

    for (int i = 0; i < particleCount; i++) {
      final x = random.nextDouble() * size.width;
      final baseY = random.nextDouble() * size.height;
      final speed = 0.5 + random.nextDouble() * 0.5;
      final y = (baseY + (animationValue * size.height * speed)) % size.height;
      final radius = 1 + random.nextDouble() * 2;

      canvas.drawCircle(Offset(x, y), radius, paint);
    }
  }

  @override
  bool shouldRepaint(ParticlesPainter oldDelegate) {
    return oldDelegate.animationValue != animationValue;
  }
}
