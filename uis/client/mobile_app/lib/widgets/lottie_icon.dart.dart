import 'package:flutter/widgets.dart';
import 'package:lottie/lottie.dart';

class LottieIcon extends StatelessWidget {
  final String assetPath; // e.g. 'assets/lottie/success.json'
  final double width;
  final double height;
  final bool repeat;
  final bool animate;
  final BoxFit fit;
  final Alignment alignment;

  const LottieIcon({
    super.key,
    required this.assetPath,
    this.width = 48,
    this.height = 48,
    this.repeat = true,
    this.animate = true,
    this.fit = BoxFit.contain,
    this.alignment = Alignment.center,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: Lottie.asset(
        assetPath,
        fit: fit,
        alignment: alignment,
        repeat: repeat,
        animate: animate,
        // you can add onLoaded/onWarning callbacks if you want
      ),
    );
  }
}
