import 'package:flutter/material.dart';
import 'face_verification_sucess.dart';


// Face Scanning Screen
class FaceScanningScreen extends StatefulWidget {
  const FaceScanningScreen({super.key});

  @override
  State<FaceScanningScreen> createState() => _FaceScanningScreenState();
}

class _FaceScanningScreenState extends State<FaceScanningScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _scanController;
  int _scanProgress = 0;
  String _scanningText = 'Position your face in the frame';
  bool _isScanning = false;

  @override
  void initState() {
    super.initState();
    _scanController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat();

    // Simulate scanning progress
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          _isScanning = true;
          _scanningText = 'Analyzing face...';
        });
        _startScanning();
      }
    });
  }

  void _startScanning() async {
    for (int i = 0; i <= 100; i += 10) {
      await Future.delayed(const Duration(milliseconds: 300));
      if (mounted) {
        setState(() {
          _scanProgress = i;
          if (i == 30) _scanningText = 'Detecting facial features...';
          if (i == 60) _scanningText = 'Verifying identity...';
          if (i == 90) _scanningText = 'Almost done...';
        });
      }
    }

    if (mounted) {
      await Future.delayed(const Duration(milliseconds: 500));
      
      // Get arguments to pass forward
      final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
      
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => const FaceVerificationSuccessScreen(),
          settings: RouteSettings(arguments: args),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            // Camera placeholder with grid
            Positioned.fill(
              child: Container(
                color: Colors.grey[900],
                child: CustomPaint(
                  painter: GridPainter(),
                ),
              ),
            ),
            
            // Face frame overlay
            Center(
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Animated scanning line
                  if (_isScanning)
                    AnimatedBuilder(
                      animation: _scanController,
                      builder: (context, child) {
                        return CustomPaint(
                          size: const Size(280, 360),
                          painter: ScanLinePainter(
                            progress: _scanController.value,
                          ),
                        );
                      },
                    ),
                  
                  // Face frame
                  CustomPaint(
                    size: const Size(280, 360),
                    painter: FaceFramePainter(
                      isScanning: _isScanning,
                    ),
                  ),
                ],
              ),
            ),
            
            // Top bar
            Positioned(
              top: 16,
              left: 16,
              right: 16,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white, size: 28),
                    onPressed: () => Navigator.pop(context),
                  ),
                  if (_isScanning)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '$_scanProgress%',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            
            // Bottom instruction
            Positioned(
              bottom: 80,
              left: 24,
              right: 24,
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.7),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Text(
                      _scanningText,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  
                  if (_isScanning) ...[
                    const SizedBox(height: 16),
                    LinearProgressIndicator(
                      value: _scanProgress / 100,
                      backgroundColor: Colors.white.withOpacity(0.3),
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.blue[400]!),
                      minHeight: 4,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _scanController.dispose();
    super.dispose();
  }
}

// Grid painter for camera background
class GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.1)
      ..strokeWidth = 1;

    // Draw vertical lines
    for (double i = 0; i < size.width; i += 40) {
      canvas.drawLine(
        Offset(i, 0),
        Offset(i, size.height),
        paint,
      );
    }

    // Draw horizontal lines
    for (double i = 0; i < size.height; i += 40) {
      canvas.drawLine(
        Offset(0, i),
        Offset(size.width, i),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// Face frame painter
class FaceFramePainter extends CustomPainter {
  final bool isScanning;

  FaceFramePainter({required this.isScanning});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = isScanning ? Colors.blue[400]! : Colors.white
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke;

    final rect = Rect.fromLTWH(0, 0, size.width, size.height);
    final rrect = RRect.fromRectAndRadius(rect, const Radius.circular(180));

    // Draw rounded rectangle
    canvas.drawRRect(rrect, paint);

    // Draw corner accents
    final cornerPaint = Paint()
      ..color = isScanning ? Colors.blue[400]! : Colors.white
      ..strokeWidth = 6
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    const cornerLength = 40.0;

    // Top-left corner
    canvas.drawLine(Offset(0, cornerLength), const Offset(0, 0), cornerPaint);
    canvas.drawLine(const Offset(0, 0), Offset(cornerLength, 0), cornerPaint);

    // Top-right corner
    canvas.drawLine(
      Offset(size.width - cornerLength, 0),
      Offset(size.width, 0),
      cornerPaint,
    );
    canvas.drawLine(
      Offset(size.width, 0),
      Offset(size.width, cornerLength),
      cornerPaint,
    );

    // Bottom-left corner
    canvas.drawLine(
      Offset(0, size.height - cornerLength),
      Offset(0, size.height),
      cornerPaint,
    );
    canvas.drawLine(
      Offset(0, size.height),
      Offset(cornerLength, size.height),
      cornerPaint,
    );

    // Bottom-right corner
    canvas.drawLine(
      Offset(size.width, size.height - cornerLength),
      Offset(size.width, size.height),
      cornerPaint,
    );
    canvas.drawLine(
      Offset(size.width, size.height),
      Offset(size.width - cornerLength, size.height),
      cornerPaint,
    );
  }

  @override
  bool shouldRepaint(FaceFramePainter oldDelegate) =>
      oldDelegate.isScanning != isScanning;
}

// Scan line painter
class ScanLinePainter extends CustomPainter {
  final double progress;

  ScanLinePainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Colors.transparent,
          Colors.blue[400]!.withOpacity(0.8),
          Colors.transparent,
        ],
      ).createShader(Rect.fromLTWH(0, 0, size.width, 40));

    final y = size.height * progress;
    canvas.drawRect(
      Rect.fromLTWH(0, y - 20, size.width, 40),
      paint,
    );
  }

  @override
  bool shouldRepaint(ScanLinePainter oldDelegate) =>
      oldDelegate.progress != progress;
}