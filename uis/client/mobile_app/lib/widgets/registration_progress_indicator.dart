import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/tenant_provider.dart';

/// An enhanced widget that displays registration progress with animated step indicators
class RegistrationProgressIndicator extends StatefulWidget {
  final int currentStep;
  final int totalSteps;
  final List<String> stepLabels;

  const RegistrationProgressIndicator({
    super.key,
    required this.currentStep,
    required this.totalSteps,
    required this.stepLabels,
  });

  @override
  State<RegistrationProgressIndicator> createState() =>
      _RegistrationProgressIndicatorState();
}

class _RegistrationProgressIndicatorState
    extends State<RegistrationProgressIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _progressAnimation;
  int _previousStep = 1;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    _progressAnimation = Tween<double>(
      begin: 0,
      end: widget.currentStep / widget.totalSteps,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOutCubic,
    ));
    _controller.forward();
  }

  @override
  void didUpdateWidget(RegistrationProgressIndicator oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentStep != widget.currentStep) {
      _previousStep = oldWidget.currentStep;
      _progressAnimation = Tween<double>(
        begin: _previousStep / widget.totalSteps,
        end: widget.currentStep / widget.totalSteps,
      ).animate(CurvedAnimation(
        parent: _controller,
        curve: Curves.easeInOutCubic,
      ));
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tenantProvider = context.watch<TenantProvider>();
    final percentage = ((widget.currentStep) / widget.totalSteps * 100).round();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: tenantProvider.surfaceColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: tenantProvider.primaryColor.withOpacity(0.08),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header with step count and percentage
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Registration Progress',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: tenantProvider.textSecondaryColor,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Step ${widget.currentStep} of ${widget.totalSteps}',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: tenantProvider.textPrimaryColor,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      tenantProvider.primaryColor,
                      tenantProvider.primaryColor.withOpacity(0.8),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: tenantProvider.primaryColor.withOpacity(0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Text(
                  '$percentage%',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Animated progress bar
          AnimatedBuilder(
            animation: _progressAnimation,
            builder: (context, child) {
              return Stack(
                children: [
                  // Background track
                  Container(
                    height: 12,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: tenantProvider.primaryColor.withOpacity(0.1),
                    ),
                  ),
                  // Animated progress fill with gradient
                  FractionallySizedBox(
                    widthFactor: _progressAnimation.value,
                    child: Container(
                      height: 12,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        gradient: LinearGradient(
                          colors: [
                            tenantProvider.primaryColor,
                            tenantProvider.primaryColor.withOpacity(0.7),
                          ],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: tenantProvider.primaryColor.withOpacity(0.4),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 28),

          // Step indicators with improved design
          Stack(
            children: [
              // Connector lines layer (under circles)
              Padding(
                padding: const EdgeInsets.only(top: 50),
                child: Row(
                  children: List.generate(
                    widget.totalSteps - 1,
                    (index) {
                      final isCompleted = index + 1 < widget.currentStep;
                      return Expanded(
                        child: Container(
                          height: 2,
                          margin: const EdgeInsets.symmetric(horizontal: 8),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(1),
                            gradient: isCompleted
                                ? LinearGradient(
                                    colors: [
                                      tenantProvider.primaryColor,
                                      tenantProvider.primaryColor.withOpacity(0.6),
                                    ],
                                  )
                                : null,
                            color: isCompleted
                                ? null
                                : tenantProvider.textSecondaryColor.withOpacity(0.15),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              // Step circles and labels layer (on top)
              Row(
                children: List.generate(widget.totalSteps, (index) {
                  final stepNumber = index + 1;
                  final isCompleted = stepNumber < widget.currentStep;
                  final isCurrent = stepNumber == widget.currentStep;

                  return Expanded(
                    child: _StepIndicator(
                      stepNumber: stepNumber,
                      label: widget.stepLabels[index],
                      isCompleted: isCompleted,
                      isCurrent: isCurrent,
                      isLast: index == widget.totalSteps - 1,
                      primaryColor: tenantProvider.primaryColor,
                      surfaceColor: tenantProvider.surfaceColor,
                      textPrimaryColor: tenantProvider.textPrimaryColor,
                      textSecondaryColor: tenantProvider.textSecondaryColor,
                    ),
                  );
                }),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  final int stepNumber;
  final String label;
  final bool isCompleted;
  final bool isCurrent;
  final bool isLast;
  final Color primaryColor;
  final Color surfaceColor;
  final Color textPrimaryColor;
  final Color textSecondaryColor;

  const _StepIndicator({
    required this.stepNumber,
    required this.label,
    required this.isCompleted,
    required this.isCurrent,
    required this.isLast,
    required this.primaryColor,
    required this.surfaceColor,
    required this.textPrimaryColor,
    required this.textSecondaryColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Circle indicator with animation
        AnimatedContainer(
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeInOutCubic,
          width: isCurrent ? 44 : 36,
          height: isCurrent ? 44 : 36,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: isCompleted || isCurrent
                ? LinearGradient(
                    colors: [
                      primaryColor,
                      primaryColor.withOpacity(0.8),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : null,
            color: isCompleted || isCurrent ? null : surfaceColor,
            border: Border.all(
              color: isCompleted || isCurrent
                  ? primaryColor
                  : textSecondaryColor.withOpacity(0.2),
              width: isCurrent ? 3 : 2,
            ),
            boxShadow: isCurrent
                ? [
                    BoxShadow(
                      color: primaryColor.withOpacity(0.4),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : isCompleted
                    ? [
                        BoxShadow(
                          color: primaryColor.withOpacity(0.2),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ]
                    : null,
          ),
          child: Center(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              transitionBuilder: (child, animation) {
                return ScaleTransition(
                  scale: animation,
                  child: child,
                );
              },
              child: isCompleted
                  ? const Icon(
                      Icons.check_rounded,
                      color: Colors.white,
                      size: 22,
                      key: ValueKey('check'),
                    )
                  : Text(
                      '$stepNumber',
                      key: ValueKey('number-$stepNumber'),
                      style: TextStyle(
                        color: isCurrent
                            ? Colors.white
                            : textSecondaryColor.withOpacity(0.6),
                        fontWeight: FontWeight.bold,
                        fontSize: isCurrent ? 16 : 14,
                      ),
                    ),
            ),
          ),
        ),
        const SizedBox(height: 10),

        // Step label with better typography
        AnimatedDefaultTextStyle(
          duration: const Duration(milliseconds: 300),
          style: TextStyle(
            fontSize: isCurrent ? 12 : 11,
            fontWeight: isCurrent ? FontWeight.w600 : FontWeight.w500,
            color: isCurrent
                ? primaryColor
                : isCompleted
                    ? textPrimaryColor.withOpacity(0.7)
                    : textSecondaryColor.withOpacity(0.6),
            height: 1.3,
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}