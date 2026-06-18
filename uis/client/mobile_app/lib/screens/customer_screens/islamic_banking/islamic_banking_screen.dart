import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../config/app_theme.dart';
import '../../../providers/tenant_provider.dart';

class IslamicBankingScreen extends StatelessWidget {
  const IslamicBankingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final tenantProvider = Provider.of<TenantProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Islamic Banking',
          style: TextStyle(fontWeight: FontWeight.w700, letterSpacing: 0.3),
        ),
        elevation: 0,
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                tenantProvider.primaryColor.withValues(alpha: 0.05),
                tenantProvider.primaryColor.withValues(alpha: 0.02),
              ],
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Section
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    tenantProvider.primaryColor,
                    tenantProvider.primaryColor.withValues(alpha: 0.8),
                  ],
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: tenantProvider.primaryColor.withValues(alpha: 0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.mosque_outlined,
                          color: Colors.white,
                          size: 32,
                        ),
                      ),
                      const SizedBox(width: 16),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Shariah-Compliant Banking',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'Interest-free financial solutions',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Our Islamic banking products are designed to comply with Shariah principles, ensuring ethical and transparent financial services.',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),

            // Products Grid
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Islamic Products',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // Murabaha
                  _ProductCard(
                    title: 'Murabaha',
                    subtitle: 'Cost-Plus Financing',
                    description: 'Purchase assets through an ethical cost-plus financing arrangement. The bank buys the asset and sells it to you at an agreed markup.',
                    icon: Icons.shopping_cart_outlined,
                    color: const Color(0xFF6C63FF),
                    onTap: () => Navigator.pushNamed(context, '/islamic-banking/murabaha'),
                  ),
                  
                  // Musharaka
                  _ProductCard(
                    title: 'Musharaka',
                    subtitle: 'Partnership Financing',
                    description: 'Enter into a partnership where profits and losses are shared based on agreed ratios. Perfect for business ventures.',
                    icon: Icons.handshake_outlined,
                    color: const Color(0xFF00BCD4),
                    onTap: () => Navigator.pushNamed(context, '/islamic-banking/musharaka'),
                  ),
                  
                  // Ijara
                  _ProductCard(
                    title: 'Ijara',
                    subtitle: 'Islamic Leasing',
                    description: 'Lease assets through Shariah-compliant arrangements. Ownership can transfer at the end of the lease period.',
                    icon: Icons.key_outlined,
                    color: const Color(0xFFFF9800),
                    onTap: () => Navigator.pushNamed(context, '/islamic-banking/ijara'),
                  ),
                  
                  // Takaful
                  _ProductCard(
                    title: 'Takaful',
                    subtitle: 'Islamic Insurance',
                    description: 'Mutual protection through cooperative insurance based on solidarity and shared responsibility.',
                    icon: Icons.shield_outlined,
                    color: const Color(0xFF4CAF50),
                    onTap: () => Navigator.pushNamed(context, '/islamic-banking/takaful'),
                  ),
                  
                  // Sukuk
                  _ProductCard(
                    title: 'Sukuk',
                    subtitle: 'Islamic Bonds',
                    description: 'Invest in Shariah-compliant securities that represent ownership in tangible assets or services.',
                    icon: Icons.account_balance_wallet_outlined,
                    color: const Color(0xFF9C27B0),
                    onTap: () => Navigator.pushNamed(context, '/islamic-banking/sukuk'),
                  ),
                  
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String description;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _ProductCard({
    required this.title,
    required this.subtitle,
    required this.description,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: Material(
        color: AppTheme.getCardBackground(context),
        borderRadius: BorderRadius.circular(16),
        elevation: 0,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              border: Border.all(
                color: AppTheme.getBorderColor(context).withValues(alpha: 0.3),
                width: 1,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    icon,
                    color: color,
                    size: 32,
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
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.getTextPrimary(context),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: color,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        description,
                        style: TextStyle(
                          fontSize: 13,
                          color: AppTheme.getTextSecondary(context),
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 18,
                  color: AppTheme.getTextSecondary(context),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
