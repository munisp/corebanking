import 'dart:ui';
import 'package:flutter/material.dart';

/// Premium liquid glass bottom navigation bar with frosted glass effect
class GlassBottomNavigationBar extends StatelessWidget {
  final int currentIndex;
  final Function(int) onTap;
  final List<GlassBottomNavigationItem> items;
  final Color primaryColor;
  final Color backgroundColor;
  final bool isDarkMode;

  const GlassBottomNavigationBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
    required this.primaryColor,
    this.backgroundColor = Colors.white,
    this.isDarkMode = false,
  });

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    
    return Container(
      margin: EdgeInsets.only(
        left: 12,
        right: 12,
        bottom: bottomPadding > 0 ? 8 : 12,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: primaryColor.withOpacity(0.1),
            blurRadius: 30,
            offset: const Offset(0, 10),
            spreadRadius: 0,
          ),
          BoxShadow(
            color: isDarkMode 
                ? Colors.black.withOpacity(0.3)
                : Colors.black.withOpacity(0.05),
            blurRadius: 20,
            offset: const Offset(0, 5),
            spreadRadius: -5,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            height: 65,
            padding: EdgeInsets.only(
              left: 4,
              right: 4,
              bottom: bottomPadding > 0 ? bottomPadding / 2 : 0
            ),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: isDarkMode
                    ? [
                        Colors.white.withOpacity(0.14),
                        Colors.white.withOpacity(0.10),
                      ]
                    : [
                        Colors.white.withOpacity(0.9),
                        Colors.white.withOpacity(0.7),
                      ],
              ),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                width: 1.5,
                color: isDarkMode
                    ? Colors.white.withOpacity(0.25)
                    : Colors.white.withOpacity(0.8),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: List.generate(
                items.length,
                (index) => Expanded(
                  child: _GlassNavigationItem(
                    item: items[index],
                    isSelected: currentIndex == index,
                    onTap: () => onTap(index),
                    primaryColor: primaryColor,
                    isDarkMode: isDarkMode,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _GlassNavigationItem extends StatefulWidget {
  final GlassBottomNavigationItem item;
  final bool isSelected;
  final VoidCallback onTap;
  final Color primaryColor;
  final bool isDarkMode;

  const _GlassNavigationItem({
    required this.item,
    required this.isSelected,
    required this.onTap,
    required this.primaryColor,
    required this.isDarkMode,
  });

  @override
  State<_GlassNavigationItem> createState() => _GlassNavigationItemState();
}

class _GlassNavigationItemState extends State<_GlassNavigationItem>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _glowAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );

    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 0.9,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));

    _glowAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(_GlassNavigationItem oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isSelected != oldWidget.isSelected) {
      if (widget.isSelected) {
        _controller.forward();
      } else {
        _controller.reverse();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => _controller.forward(),
      onTapUp: (_) => _controller.reverse(),
      onTapCancel: () => _controller.reverse(),
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return Transform.scale(
            scale: widget.isSelected ? 1.0 : _scaleAnimation.value,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 6),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Icon with glow effect
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      // Glow effect
                      if (widget.isSelected)
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: RadialGradient(
                              colors: [
                                widget.primaryColor.withOpacity(0.3 * _glowAnimation.value),
                                widget.primaryColor.withOpacity(0),
                              ],
                            ),
                          ),
                        ),
                      // Icon container with glass effect
                      Container(
                        padding: const EdgeInsets.all(5),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          gradient: widget.isSelected
                              ? LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    widget.primaryColor.withOpacity(0.2),
                                    widget.primaryColor.withOpacity(0.1),
                                  ],
                                )
                              : null,
                          border: widget.isSelected
                              ? Border.all(
                                  color: widget.primaryColor.withOpacity(0.3),
                                  width: 1,
                                )
                              : null,
                        ),
                        child: Icon(
                          widget.isSelected
                              ? widget.item.activeIcon
                              : widget.item.icon,
                          color: widget.isSelected
                              ? widget.primaryColor
                              : widget.isDarkMode
                                  ? Colors.white
                                  : Colors.grey.shade600,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  // Label
                  Flexible(
                    child: AnimatedDefaultTextStyle(
                      duration: const Duration(milliseconds: 200),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight:
                            widget.isSelected ? FontWeight.w600 : FontWeight.w500,
                        color: widget.isSelected
                            ? widget.primaryColor
                            : widget.isDarkMode
                                ? Colors.white.withOpacity(0.6)
                                : Colors.grey.shade600,
                        letterSpacing: 0,
                        height: 1.1,
                      ),
                      child: Text(
                        widget.item.label,
                        maxLines: 1,
                        overflow: TextOverflow.clip,
                        textAlign: TextAlign.center,
                        softWrap: false,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class GlassBottomNavigationItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;

  const GlassBottomNavigationItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
}
