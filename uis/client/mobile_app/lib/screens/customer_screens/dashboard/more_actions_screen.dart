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
      // ================= W12-A4P2MOBILE =================
      // P2-B WIRE batch: these routes existed in main.dart but had no nav path
      // (deep-link only). Entries below make every one reachable. Routes that
      // are brand-new (W12-A4P2MOBILE additions to main.dart) are marked.
      {
        'title': 'Add Account',
        'subtitle': 'Open or link an additional account',
        'icon': Icons.account_balance_wallet_outlined,
        'route': '/add-account',
        'keywords': ['account', 'add', 'open', 'new', 'link'],
        'isVisible': true,
      },
      {
        'title': 'Bank Details',
        'subtitle': 'View your account & bank details',
        'icon': Icons.account_balance_outlined,
        'route': '/bank-details', // new route (W12-A4P2MOBILE)
        'keywords': ['bank', 'details', 'account', 'number', 'branch'],
        'isVisible': true,
      },
      {
        'title': 'Deposit',
        'subtitle': 'Fund your account',
        'icon': Icons.savings_outlined,
        'route': '/deposit', // new route (W12-A4P2MOBILE)
        'keywords': ['deposit', 'fund', 'top up', 'add money', 'cash in'],
        'isVisible': true,
      },
      {
        'title': 'Scheduled Payments',
        'subtitle': 'Standing orders & future-dated payments',
        'icon': Icons.schedule_outlined,
        'route': '/scheduled-payments',
        'keywords': ['scheduled', 'standing order', 'recurring', 'future', 'auto pay'],
        'isVisible': true,
      },
      {
        'title': 'Transaction Receipt',
        'subtitle': 'View & share transaction receipts',
        'icon': Icons.receipt_outlined,
        'route': '/receipt',
        'keywords': ['receipt', 'proof', 'transaction', 'share'],
        'isVisible': true,
      },
      {
        'title': 'Insurance Claims',
        'subtitle': 'File & track insurance claims',
        'icon': Icons.assignment_outlined,
        'route': '/insurance/claims', // new route (W12-A4P2MOBILE)
        'keywords': ['insurance', 'claim', 'file', 'track'],
        'isVisible': true,
      },
      {
        'title': 'Premium Payments',
        'subtitle': 'Pay insurance premiums',
        'icon': Icons.payments_outlined,
        'route': '/insurance/premium-payments', // new route (W12-A4P2MOBILE)
        'keywords': ['insurance', 'premium', 'payment', 'policy'],
        'isVisible': true,
      },
      {
        'title': 'Project Finance',
        'subtitle': 'Apply for project financing',
        'icon': Icons.engineering_outlined,
        'route': '/project-finance/apply',
        'keywords': ['project', 'finance', 'loan', 'infrastructure', 'apply'],
        'isVisible': true,
      },
      {
        'title': 'Biometric Enrollment',
        'subtitle': 'Register fingerprint & face biometrics',
        'icon': Icons.fingerprint_outlined,
        'route': '/biometric-enrollment',
        'keywords': ['biometric', 'fingerprint', 'face', 'enroll', 'security'],
        'isVisible': true,
      },
      {
        'title': 'Face Verification',
        'subtitle': 'Verify your identity with a face scan',
        'icon': Icons.face_outlined,
        'route': '/face-verification',
        'keywords': ['face', 'verification', 'kyc', 'identity', 'selfie'],
        'isVisible': true,
      },
      {
        'title': 'Language',
        'subtitle': 'Change app language',
        'icon': Icons.language_outlined,
        'route': '/language-selection',
        'keywords': ['language', 'english', 'igbo', 'yoruba', 'hausa', 'locale'],
        'isVisible': true,
      },
      {
        'title': 'Open Banking Consent',
        'subtitle': 'Manage third-party data sharing consents',
        'icon': Icons.handshake_outlined,
        'route': '/settings/open-banking',
        'keywords': ['open banking', 'consent', 'third party', 'data sharing', 'api'],
        'isVisible': true,
      },
      // ---------- Agriculture sub-features (deep-link-only routes wired) ----------
      {
        'title': 'Agri eVoucher',
        'subtitle': 'Input vouchers & redemption',
        'icon': Icons.confirmation_number_outlined,
        'route': '/agriculture/evoucher',
        'keywords': ['agri', 'evoucher', 'voucher', 'input', 'redemption', 'subsidy'],
        'isVisible': true,
      },
      {
        'title': 'Input Marketplace',
        'subtitle': 'Buy seeds, fertilizer & agro inputs',
        'icon': Icons.storefront_outlined,
        'route': '/agriculture/input-marketplace',
        'keywords': ['agri', 'input', 'marketplace', 'seeds', 'fertilizer', 'buy'],
        'isVisible': true,
      },
      {
        'title': 'IoT Sensors',
        'subtitle': 'Farm sensor monitoring',
        'icon': Icons.sensors_outlined,
        'route': '/agriculture/iot-sensors',
        'keywords': ['agri', 'iot', 'sensor', 'monitor', 'farm'],
        'isVisible': true,
      },
      {
        'title': 'Agri Logistics',
        'subtitle': 'Farm produce transport & logistics',
        'icon': Icons.local_shipping_outlined,
        'route': '/agriculture/logistics',
        'keywords': ['agri', 'logistics', 'transport', 'delivery', 'haulage'],
        'isVisible': true,
      },
      {
        'title': 'Agri Reinsurance',
        'subtitle': 'Agricultural reinsurance cover',
        'icon': Icons.verified_user_outlined,
        'route': '/agriculture/reinsurance',
        'keywords': ['agri', 'reinsurance', 'cover', 'risk'],
        'isVisible': true,
      },
      {
        'title': 'Savings Cycles',
        'subtitle': 'Seasonal agri savings cycles',
        'icon': Icons.autorenew_outlined,
        'route': '/agriculture/savings-cycles',
        'keywords': ['agri', 'savings', 'cycle', 'seasonal'],
        'isVisible': true,
      },
      {
        'title': 'ESG Impact',
        'subtitle': 'Sustainability & ESG impact tracking',
        'icon': Icons.eco_outlined,
        'route': '/agriculture/esg-impact',
        'keywords': ['agri', 'esg', 'impact', 'sustainability', 'environment'],
        'isVisible': true,
      },
      {
        'title': 'Animal ID & Traceability',
        'subtitle': 'Livestock identification & tracking',
        'icon': Icons.pets_outlined,
        'route': '/agriculture/animal-id',
        'keywords': ['agri', 'animal', 'id', 'traceability', 'livestock', 'tag'],
        'isVisible': true,
      },
      {
        'title': 'Area Yield Insurance',
        'subtitle': 'Area-yield index crop insurance',
        'icon': Icons.shield_outlined,
        'route': '/agriculture/area-yield-insurance',
        'keywords': ['agri', 'area', 'yield', 'index', 'insurance', 'crop'],
        'isVisible': true,
      },
      {
        'title': 'Anchor Borrowers',
        'subtitle': 'CBN Anchor Borrowers programme',
        'icon': Icons.anchor_outlined,
        'route': '/agriculture/cbn-anchor-borrowers',
        'keywords': ['agri', 'cbn', 'anchor', 'borrowers', 'programme', 'loan'],
        'isVisible': true,
      },
      {
        'title': 'Coop Credit Scoring',
        'subtitle': 'Cooperative credit scoring',
        'icon': Icons.score_outlined,
        'route': '/agriculture/cooperative-credit-scoring',
        'keywords': ['agri', 'cooperative', 'credit', 'scoring', 'score'],
        'isVisible': true,
      },
      {
        'title': 'Coop Financials',
        'subtitle': 'Cooperative financial statements',
        'icon': Icons.account_tree_outlined,
        'route': '/agriculture/cooperative-financials',
        'keywords': ['agri', 'cooperative', 'financials', 'statement'],
        'isVisible': true,
      },
      {
        'title': 'Coop Management',
        'subtitle': 'Manage your cooperative society',
        'icon': Icons.groups_outlined,
        'route': '/agriculture/cooperative-management',
        'keywords': ['agri', 'cooperative', 'management', 'society', 'members'],
        'isVisible': true,
      },
      {
        'title': 'Coop Meetings',
        'subtitle': 'Cooperative meetings & resolutions',
        'icon': Icons.event_outlined,
        'route': '/agriculture/cooperative-meetings',
        'keywords': ['agri', 'cooperative', 'meeting', 'resolution', 'agm'],
        'isVisible': true,
      },
      {
        'title': 'Crop Yield Prediction',
        'subtitle': 'AI crop yield forecasts',
        'icon': Icons.insights_outlined,
        'route': '/agriculture/crop-yield-prediction',
        'keywords': ['agri', 'crop', 'yield', 'prediction', 'forecast', 'ai'],
        'isVisible': true,
      },
      {
        'title': 'Farm Boundary Mapping',
        'subtitle': 'Map & geotag farm boundaries',
        'icon': Icons.map_outlined,
        'route': '/agriculture/farm-boundary-mapping',
        'keywords': ['agri', 'farm', 'boundary', 'mapping', 'geotag', 'gps'],
        'isVisible': true,
      },
      {
        'title': 'Livestock Finance',
        'subtitle': 'Financing for livestock production',
        'icon': Icons.agriculture_outlined,
        'route': '/agriculture/livestock-finance',
        'keywords': ['agri', 'livestock', 'finance', 'cattle', 'poultry'],
        'isVisible': true,
      },
      {
        'title': 'Livestock Insurance',
        'subtitle': 'Insure your livestock',
        'icon': Icons.health_and_safety_outlined,
        'route': '/agriculture/livestock-insurance',
        'keywords': ['agri', 'livestock', 'insurance', 'cover'],
        'isVisible': true,
      },
      {
        'title': 'Livestock Management',
        'subtitle': 'Herd records & management',
        'icon': Icons.inventory_2_outlined,
        'route': '/agriculture/livestock-management',
        'keywords': ['agri', 'livestock', 'management', 'herd', 'records'],
        'isVisible': true,
      },
      {
        'title': 'Multi-Peril Crop Insurance',
        'subtitle': 'Comprehensive crop cover',
        'icon': Icons.umbrella_outlined,
        'route': '/agriculture/multi-peril-insurance',
        'keywords': ['agri', 'multi-peril', 'crop', 'insurance', 'cover'],
        'isVisible': true,
      },
      {
        'title': 'NIRSAL Agro GeoCoop',
        'subtitle': 'NIRSAL geo-cooperative financing',
        'icon': Icons.hub_outlined,
        'route': '/agriculture/nirsal-geocoop',
        'keywords': ['agri', 'nirsal', 'geocoop', 'financing'],
        'isVisible': true,
      },
      {
        'title': 'NIRSAL Credit Guarantee',
        'subtitle': 'Credit guarantee cover',
        'icon': Icons.verified_outlined,
        'route': '/agriculture/nirsal-credit-guarantee',
        'keywords': ['agri', 'nirsal', 'credit', 'guarantee', 'cover'],
        'isVisible': true,
      },
      {
        'title': 'Satellite Crop Monitor',
        'subtitle': 'Satellite-based crop monitoring',
        'icon': Icons.satellite_alt_outlined,
        'route': '/agriculture/satellite-monitor',
        'keywords': ['agri', 'satellite', 'crop', 'monitor', 'remote sensing'],
        'isVisible': true,
      },
      {
        'title': 'Soil Analysis',
        'subtitle': 'Soil testing & recommendations',
        'icon': Icons.science_outlined,
        'route': '/agriculture/soil-analysis',
        'keywords': ['agri', 'soil', 'analysis', 'testing', 'nutrients'],
        'isVisible': true,
      },
      {
        'title': 'Fisheries & Aquaculture',
        'subtitle': 'Fish farming finance & support',
        'icon': Icons.set_meal_outlined,
        'route': '/agriculture/fisheries',
        'keywords': ['agri', 'fisheries', 'aquaculture', 'fish', 'farming'],
        'isVisible': true,
      },
      {
        'title': 'Agricultural Insurance',
        'subtitle': 'Farm & crop insurance products',
        'icon': Icons.grass_outlined,
        'route': '/agriculture/insurance', // new route (W12-A4P2MOBILE)
        'keywords': ['agri', 'agricultural', 'insurance', 'farm', 'crop'],
        'isVisible': true,
      },
      {
        'title': 'Equipment Leasing',
        'subtitle': 'Apply to lease farm equipment',
        'icon': Icons.agriculture_rounded,
        'route': '/equipment-leasing/apply',
        'keywords': ['equipment', 'leasing', 'tractor', 'machinery', 'lease', 'apply'],
        'isVisible': true,
      },
      // ---------- Voice banking (deep-link-only routes wired) ----------
      {
        'title': 'Voice ASR (Nigerian)',
        'subtitle': 'Nigerian-accent speech recognition',
        'icon': Icons.record_voice_over_outlined,
        'route': '/voice-asr',
        'keywords': ['voice', 'asr', 'speech', 'recognition', 'nigerian'],
        'isVisible': true,
      },
      {
        'title': 'Voice TTS (Nigerian)',
        'subtitle': 'Nigerian-accent text-to-speech',
        'icon': Icons.campaign_outlined,
        'route': '/voice-tts',
        'keywords': ['voice', 'tts', 'text to speech', 'nigerian'],
        'isVisible': true,
      },
      {
        'title': 'Voice Biometric Auth',
        'subtitle': 'Authenticate with your voiceprint',
        'icon': Icons.mic_external_on_outlined,
        'route': '/voice-biometric',
        'keywords': ['voice', 'biometric', 'voiceprint', 'auth', 'security'],
        'isVisible': true,
      },
      {
        'title': 'Voice IVR Menu',
        'subtitle': 'Interactive voice response banking',
        'icon': Icons.dialpad_outlined,
        'route': '/voice-ivr',
        'keywords': ['voice', 'ivr', 'menu', 'phone', 'banking'],
        'isVisible': true,
      },
      {
        'title': 'Voice NLU Banking',
        'subtitle': 'Natural-language voice commands',
        'icon': Icons.psychology_outlined,
        'route': '/voice-nlu',
        'keywords': ['voice', 'nlu', 'natural language', 'commands'],
        'isVisible': true,
      },
      {
        'title': 'Voice Gateway',
        'subtitle': 'Voice banking gateway & channels',
        'icon': Icons.router_outlined,
        'route': '/voice-gateway',
        'keywords': ['voice', 'gateway', 'channel', 'banking'],
        'isVisible': true,
      },
      {
        'title': 'Voice Agent Escalation',
        'subtitle': 'Escalate to a live agent',
        'icon': Icons.support_agent_outlined,
        'route': '/voice-escalation',
        'keywords': ['voice', 'agent', 'escalation', 'support', 'human'],
        'isVisible': true,
      },
      // ---------- Auth/flow utility screens (wired for reachability) ----------
      {
        'title': 'Email OTP',
        'subtitle': 'Email one-time passcode verification',
        'icon': Icons.mark_email_read_outlined,
        'route': '/email-otp',
        'keywords': ['email', 'otp', 'verification', 'code'],
        'isVisible': true,
      },
      {
        'title': 'Login OTP',
        'subtitle': 'One-time passcode login',
        'icon': Icons.password_outlined,
        'route': '/login-otp',
        'keywords': ['login', 'otp', 'passcode', 'sign in'],
        'isVisible': true,
      },
      {
        'title': 'Password Created',
        'subtitle': 'Password setup confirmation',
        'icon': Icons.check_circle_outline,
        'route': '/password-created',
        'keywords': ['password', 'created', 'confirmation', 'success'],
        'isVisible': true,
      },
      {
        'title': 'Enter PIN',
        'subtitle': 'Transaction PIN entry',
        'icon': Icons.pin_outlined,
        'route': '/input-pin',
        'keywords': ['pin', 'enter', 'transaction', 'confirm'],
        'isVisible': true,
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

