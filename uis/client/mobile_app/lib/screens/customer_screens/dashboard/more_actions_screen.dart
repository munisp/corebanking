import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../l10n/app_localizations.dart';
import '../../../providers/tenant_provider.dart';
import '../../../config/app_theme.dart';

class MoreActionsScreen extends StatefulWidget {
  const MoreActionsScreen({super.key});

  @override
  State<MoreActionsScreen> createState() => _MoreActionsScreenState();
}

class _MoreActionsScreenState extends State<MoreActionsScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<Map<String, dynamic>> _filteredActions = [];

  List<Map<String, dynamic>> _getAllActions(BuildContext context) {
    final tenantConfig = Provider.of<TenantProvider>(context, listen: false).tenantConfig;
    final l10n = AppLocalizations.of(context)!;
    return [
      {
        'title': 'Buy Now Pay Later',
        'subtitle': 'Shop now, pay in easy instalments',
        'icon': Icons.credit_score_outlined,
        'route': '/bnpl',
        'keywords': ['bnpl', 'buy now pay later', 'instalment', 'installment', 'credit', 'shop', 'merchant'],
        'isVisible': tenantConfig.isFeatureEnabled('bnpl'),
      },
      {
        'title': 'Trade Finance',
        'subtitle': 'Letters of credit, guarantees & factoring',
        'icon': Icons.public_outlined,
        'route': '/trade-finance',
        'keywords': ['trade', 'finance', 'lc', 'letter of credit', 'guarantee', 'factoring', 'import', 'export', 'swift'],
        'isVisible': tenantConfig.isFeatureEnabled('trade_finance'),
      },
      {
        'title': 'Bulk Transfer',
        'subtitle': 'Send to multiple accounts at once',
        'icon': Icons.layers_outlined,
        'route': '/bulk-transfer',
        'keywords': ['bulk', 'batch', 'salary', 'multiple', 'transfer', 'mass', 'payroll'],
        'isVisible': true,
      },
      {
        'title': l10n.activeLoans,
        'subtitle': l10n.activeLoansSub,
        'icon': Icons.trending_up_outlined,
        'route': '/active-loans',
        'keywords': ['loan', 'active', 'borrow', 'credit'],
        'isVisible': tenantConfig.isFeatureEnabled('loans'),
      },
      {
        'title': l10n.activeLpos,
        'subtitle': l10n.activeLposSub,
        'icon': Icons.description_outlined,
        'route': '/active-lpos',
        'keywords': ['lpo', 'purchase', 'order'],
        'isVisible': tenantConfig.isFeatureEnabled('lpo'),
      },
      {
        'title': l10n.savings,
        'subtitle': l10n.savingsSub,
        'icon': Icons.pie_chart_outline,
        'route': '/savings',
        'keywords': ['save', 'savings', 'goal', 'target'],
        'isVisible': tenantConfig.isFeatureEnabled('savings'),
      },
      {
        'title': 'Pension',
        'subtitle': 'RSA accounts, PFA contributions & retirement funds',
        'icon': Icons.account_balance_outlined,
        'route': '/pensions',
        'keywords': ['pension', 'rsa', 'pfa', 'retirement', 'contribution', 'fund'],
        'isVisible': tenantConfig.isFeatureEnabled('pension'),
      },
      {
        'title': l10n.disputes,
        'subtitle': l10n.disputesSub,
        'icon': Icons.gavel_outlined,
        'route': '/disputes',
        'keywords': ['dispute', 'complaint', 'issue', 'problem'],
        'isVisible': tenantConfig.isFeatureEnabled('dispute'),
      },
      {
        'title': l10n.bills,
        'subtitle': l10n.billsSub,
        'icon': Icons.receipt_long_outlined,
        'route': '/bills',
        'keywords': ['bills', 'payment', 'utilities', 'pay'],
        'isVisible': tenantConfig.isFeatureEnabled('bill_payments'),
      },
      // {
      //   'title': l10n.cheques,
      //   'subtitle': l10n.chequesSub,
      //   'icon': Icons.edit_note_outlined,
      //   'route': '/cheques',
      //   'keywords': ['cheque', 'cheques', 'bank', 'draft'],
      //   'isVisible': tenantConfig.isFeatureEnabled('cheques'),
      // },
      {
        'title': l10n.rewards,
        'subtitle': l10n.rewardsSub,
        'icon': Icons.card_giftcard_outlined,
        'route': '/rewards',
        'keywords': ['reward', 'credit', 'points', 'redeem'],
        'isVisible': tenantConfig.isFeatureEnabled('gamification'),
      },
      // {
      //   'title': l10n.fx,
      //   'subtitle': l10n.fxSub,
      //   'icon': Icons.currency_exchange_outlined,
      //   'route': '/fx',
      //   'keywords': ['fx', 'forex', 'exchange', 'currency'],
      //   'isVisible': tenantConfig.isFeatureEnabled('fx'),
      // },
      {
        'title': l10n.insurance,
        'subtitle': l10n.insuranceSub,
        'icon': Icons.shield_outlined,
        'route': '/insurance',
        'keywords': ['insurance', 'protect', 'cover'],
        'isVisible': tenantConfig.isFeatureEnabled('insurance'),
      },
      // {
      //   'title': l10n.investments,
      //   'subtitle': l10n.investmentsSub,
      //   'icon': Icons.trending_up,
      //   'route': '/investments',
      //   'keywords': ['invest', 'investment', 'portfolio', 'stocks'],
      //   'isVisible': tenantConfig.isFeatureEnabled('investments'),
      // },
      {
        'title': l10n.bankStatement,
        'subtitle': l10n.bankStatementSub,
        'icon': Icons.description_outlined,
        'route': '/bank-statement',
        'keywords': ['statement', 'download', 'pdf', 'history'],
        'isVisible': tenantConfig.isFeatureEnabled('accounts'),
      },
      {
        'title': l10n.carbonCredits,
        'subtitle': l10n.carbonCreditsSub,
        'icon': Icons.eco_outlined,
        'route': '/carbon-credits',
        'keywords': ['carbon', 'credit', 'environment', 'green'],
        'isVisible': tenantConfig.isFeatureEnabled('carbon_credits'),
      },
      {
        'title': l10n.cards,
        'subtitle': l10n.cardsSub,
        'icon': Icons.credit_card_outlined,
        'route': '/cards',
        'keywords': ['card', 'credit', 'debit'],
        'isVisible': tenantConfig.isFeatureEnabled('card_management'),
      },
      {
        'title': l10n.transactionHistory,
        'subtitle': l10n.transactionHistorySub,
        'icon': Icons.history_outlined,
        'route': '/transaction-history',
        'keywords': ['transaction', 'history', 'all', 'list'],
        'isVisible': tenantConfig.isFeatureEnabled('reporting'),
      },
      {
        'title': l10n.voiceBanking,
        'subtitle': l10n.voiceBankingSub,
        'icon': Icons.mic_outlined,
        'route': '/voice-assistant',
        'keywords': ['voice', 'assistant', 'speak', 'talk', 'command'],
        'isVisible': true,  // Always visible
      },
      {
        'title': l10n.qrCode,
        'subtitle': l10n.qrCodeSub,
        'icon': Icons.qr_code_outlined,
        'route': '/qrcode',
        'keywords': ['qr', 'code', 'scan', 'show'],
        'isVisible': tenantConfig.isFeatureEnabled('qr_payments'),
      },
      {
        'title': l10n.escrowBanking,
        'subtitle': l10n.escrowBankingSub,
        'icon': Icons.security_outlined,
        'route': '/escrow',
        'keywords': ['escrow', 'secure', 'third-party', 'transaction', 'property'],
        'isVisible': tenantConfig.isFeatureEnabled('escrow'),
      },
      {
        'title': l10n.mortgageBanking,
        'subtitle': l10n.mortgageBankingSub,
        'icon': Icons.home_outlined,
        'route': '/mortgage',
        'keywords': ['mortgage', 'home', 'loan', 'property', 'house'],
        'isVisible': tenantConfig.isFeatureEnabled('mortgage'),
      },
      {
        'title': l10n.educationBanking,
        'subtitle': l10n.educationBankingSub,
        'icon': Icons.school_outlined,
        'route': '/education-loans',
        'keywords': ['education', 'school', 'student', 'loan', 'tuition'],
        'isVisible': tenantConfig.isFeatureEnabled('education_loans'),
      },
      {
        'title': l10n.agricultureBanking,
        'subtitle': l10n.agricultureBankingSub,
        'icon': Icons.agriculture_outlined,
        'route': '/agriculture',
        'keywords': ['agriculture', 'farming', 'agri', 'farm', 'crop', 'livestock'],
        'isVisible': tenantConfig.isFeatureEnabled('agriculture_finance'),
      },
      {
        'title': l10n.esusuBanking,
        'subtitle': l10n.esusuBankingSub,
        'icon': Icons.groups_outlined,
        'route': '/esusu',
        'keywords': ['esusu', 'savings', 'group', 'rotating', 'contribution'],
        'isVisible': tenantConfig.isFeatureEnabled('esusu'),
      },
      {
        'title': 'Islamic Banking',
        'subtitle': 'Shariah-compliant financial products',
        'icon': Icons.mosque_outlined,
        'route': '/islamic-banking',
        'keywords': ['islamic', 'shariah', 'halal', 'murabaha', 'musharaka', 'ijara', 'takaful', 'sukuk', 'islamic banking'],
        'isVisible': tenantConfig.isFeatureEnabled('islamic_banking'),
      },
      // {
      //   'title': l10n.vanManagement,
      //   'subtitle': l10n.vanManagementSub,
      //   'icon': Icons.account_balance_outlined,
      //   'route': '/van',
      //   'keywords': ['van', 'virtual', 'account', 'number', 'payment'],
      //   'isVisible': true,
      // },
      {
        'title': 'Diaspora Banking',
        'subtitle': 'International accounts & domiciliary banking',
        'icon': Icons.flight_outlined,
        'route': '/diaspora-banking',
        'keywords': ['diaspora', 'international', 'domiciliary', 'abroad', 'foreign'],
        'isVisible': tenantConfig.isFeatureEnabled('diaspora_banking'),
      },
      {
        'title': 'Remittance',
        'subtitle': 'Send money across borders',
        'icon': Icons.send_outlined,
        'route': '/remittance',
        'keywords': ['remittance', 'transfer', 'international', 'send', 'foreign'],
        'isVisible': tenantConfig.isFeatureEnabled('remittance'),
      },
      {
        'title': 'eNaira / CBDC',
        'subtitle': 'Central Bank Digital Currency wallet',
        'icon': Icons.currency_bitcoin_outlined,
        'route': '/cbdc',
        'keywords': ['enaira', 'cbdc', 'digital', 'currency', 'cbn', 'wallet'],
        'isVisible': tenantConfig.isFeatureEnabled('cbdc'),
      },
      {
        'title': 'Wealth Management',
        'subtitle': 'Portfolio management & investment advisory',
        'icon': Icons.trending_up_outlined,
        'route': '/wealth-management',
        'keywords': ['wealth', 'portfolio', 'investment', 'advisory', 'hnw'],
        'isVisible': tenantConfig.isFeatureEnabled('wealth_management'),
      },
    ];
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _filteredActions = _getAllActions(context).toList();
      setState(() {});
    });
    _searchController.addListener(_filterActions);
  }

  @override
  void dispose() {
    _searchController.removeListener(_filterActions);
    _searchController.dispose();
    super.dispose();
  }

  void _filterActions() {
    final query = _searchController.text.toLowerCase().trim();
    if (query.isEmpty) {
      setState(() {
        _filteredActions = _getAllActions(context).toList();
      });
      return;
    }

    setState(() {
      _filteredActions = _getAllActions(context).where((action) {
        final title = action['title'].toString().toLowerCase();
        final subtitle = action['subtitle'].toString().toLowerCase();
        final keywords = (action['keywords'] as List).map((k) => k.toString().toLowerCase()).toList();
        return title.contains(query) ||
            subtitle.contains(query) ||
            keywords.any((keyword) => keyword.contains(query));
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    
    return Consumer<TenantProvider>(
      builder: (context, tenantProvider, _) {
        return Scaffold(
          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
          appBar: AppBar(
            title: Text(
              l10n.moreActions,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
                color: AppTheme.getTextPrimary(context),
              ),
            ),
            elevation: 0,
            backgroundColor: Theme.of(context).scaffoldBackgroundColor,
            leading: IconButton(
              icon: Icon(
                Icons.arrow_back_rounded,
                color: AppTheme.getTextPrimary(context),
              ),
              onPressed: () => Navigator.pop(context),
            ),
          ),
          body: Column(
            children: [
              // Search bar with premium design
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppTheme.getCardBackground(context),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: _searchController.text.isNotEmpty
                          ? tenantProvider.primaryColor.withValues(alpha: 0.3)
                          : AppTheme.getBorderColor(context).withValues(alpha: 0.3),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: _searchController.text.isNotEmpty
                            ? tenantProvider.primaryColor.withValues(alpha: 0.08)
                            : AppTheme.getBorderColor(context).withValues(alpha: 0.05),
                        blurRadius: 12,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: TextField(
                    controller: _searchController,
                    style: TextStyle(
                      color: AppTheme.getTextPrimary(context),
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.2,
                    ),
                    decoration: InputDecoration(
                      hintText: l10n.searchActions,
                      hintStyle: TextStyle(
                        color: AppTheme.getTextSecondary(context),
                        fontWeight: FontWeight.w500,
                      ),
                      prefixIcon: Container(
                        padding: const EdgeInsets.all(12),
                        child: Icon(
                          Icons.search_rounded,
                          color: tenantProvider.primaryColor,
                          size: 22,
                        ),
                      ),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: Icon(
                                Icons.clear_rounded,
                                color: AppTheme.getTextSecondary(context),
                              ),
                              onPressed: () {
                                _searchController.clear();
                              },
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    ),
                  ),
                ),
              ),
              
              // Actions grid with premium cards
              Expanded(
                child: _filteredActions.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    tenantProvider.primaryColor.withValues(alpha: 0.1),
                                    tenantProvider.secondaryColor.withValues(alpha: 0.1),
                                  ],
                                ),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                Icons.search_off_rounded,
                                size: 64,
                                color: tenantProvider.primaryColor.withValues(alpha: 0.6),
                              ),
                            ),
                            const SizedBox(height: 24),
                            Text(
                              'No actions found',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.getTextPrimary(context),
                                letterSpacing: 0.3,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Try a different search term',
                              style: TextStyle(
                                fontSize: 14,
                                color: AppTheme.getTextSecondary(context),
                                letterSpacing: 0.2,
                              ),
                            ),
                          ],
                        ),
                      )
                    : GridView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          childAspectRatio: 1.1,
                          crossAxisSpacing: 14,
                          mainAxisSpacing: 14,
                        ),
                        itemCount: _filteredActions.length,
                        itemBuilder: (context, index) {
                          final action = _filteredActions[index];
                          return _buildActionCard(
                            context: context,
                            tenantProvider: tenantProvider,
                            title: action['title'] as String,
                            subtitle: action['subtitle'] as String,
                            icon: action['icon'] as IconData,
                            route: action['route'] as String,
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildActionCard({
    required BuildContext context,
    required TenantProvider tenantProvider,
    required String title,
    required String subtitle,
    required IconData icon,
    required String route,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.getCardBackground(context),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppTheme.getBorderColor(context).withValues(alpha: 0.5),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: AppTheme.getBorderColor(context).withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            Navigator.pushNamed(context, route);
          },
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        tenantProvider.primaryColor.withValues(alpha: 0.12),
                        tenantProvider.secondaryColor.withValues(alpha: 0.12),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: tenantProvider.primaryColor.withValues(alpha: 0.15),
                      width: 1,
                    ),
                  ),
                  child: Icon(
                    icon,
                    color: tenantProvider.primaryColor,
                    size: 18,
                  ),
                ),
                // const Spacer(),
                const SizedBox(height: 8),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.getTextPrimary(context),
                    letterSpacing: 0.2,
                    height: 1.2,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Flexible(
                  child: Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 11,
                      color: AppTheme.getTextSecondary(context),
                      letterSpacing: 0.1,
                      height: 1.3,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

