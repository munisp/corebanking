import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import 'package:avatar_glow/avatar_glow.dart';
import 'package:intl/intl.dart';
import '../../../config/voice_banking_config.dart';
import '../../../providers/voice_banking_provider.dart';
import '../../../providers/tenant_provider.dart';
import '../../../providers/wallet_provider.dart';
import '../../../services/voice_command_parser.dart';
import '../../../models/voice_profile.dart';
import '../transfers/transfer_screen.dart';
import '../bills/bill_payment_screen.dart';
import '../transaction/transaction_history.dart';
import '../loans/loans_application_screen.dart';
import '../savings/savings_list_screen.dart';

class VoiceAssistantScreen extends StatefulWidget {
  const VoiceAssistantScreen({super.key});

  @override
  State<VoiceAssistantScreen> createState() => _VoiceAssistantScreenState();
}

class _VoiceAssistantScreenState extends State<VoiceAssistantScreen>
    with SingleTickerProviderStateMixin {
  bool _isInitialized = false;
  VoiceCommand? _lastProcessedCommand;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializeVoiceBanking();
    });
  }

  void _setupAnimations() {
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.95, end: 1.05).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    // Remove listener on dispose
    try {
      final voiceProvider =
          Provider.of<VoiceBankingProvider>(context, listen: false);
      voiceProvider.removeListener(_onVoiceCommandChanged);
    } catch (e) {
      debugPrint('Error removing listener: $e');
    }
    super.dispose();
  }

  // Listener that auto-processes commands when they change
  void _onVoiceCommandChanged() {
    final voiceProvider =
        Provider.of<VoiceBankingProvider>(context, listen: false);
    
    // Only process if we have a new command that hasn't been processed yet
    if (voiceProvider.currentCommand != null &&
        voiceProvider.currentCommand != _lastProcessedCommand &&
        !voiceProvider.isProcessing) {
      debugPrint('🆕 New command detected, auto-processing...');
      _lastProcessedCommand = voiceProvider.currentCommand;
      _handleVoiceCommand(voiceProvider);
    }
  }

  Future<void> _initializeVoiceBanking() async {
    try {
      debugPrint(
          '🎤 Initializing voice banking (mock: ${VoiceBankingConfig.useMockVoiceBanking})');

      bool success = false;

      
        final voiceProvider =
            Provider.of<VoiceBankingProvider>(context, listen: false);
        debugPrint('🎤 Found VoiceBankingProvider');
        success = await voiceProvider.initialize();
        debugPrint('🎤 Real provider initialized: $success');

        setState(() {
          _isInitialized = success;
        });

        if (success) {
          // Listen for command changes to auto-process them
          voiceProvider.addListener(_onVoiceCommandChanged);
          
          await voiceProvider.voiceService
              .speak('Voice banking activated. How can I help you today?');
        } else {
          if (mounted) {
            _showErrorSnackBar(voiceProvider.errorMessage ??
                'Failed to initialize voice banking');
          }
        }
      
    } catch (e) {
      debugPrint('Error initializing voice banking: $e');
      if (mounted) {
        setState(() {
          _isInitialized = false;
        });
        _showErrorSnackBar('Error: $e');
      }
    }
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.error_outline, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: Colors.red.shade700,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 5),
      ),
    );
  }

  void _showSuccessSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_outline, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: Colors.green.shade700,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _handleVoiceCommand(dynamic voiceProvider) async {
    if (voiceProvider.currentCommand == null) return;

    // Process the command first
    await voiceProvider.processCurrentCommand();

    // Navigate based on command type
    if (!mounted) return;

    switch (voiceProvider.currentCommand!.type) {
      case VoiceCommandType.checkBalance:
        _showBalanceDialog();
        break;

      case VoiceCommandType.transfer:
        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const TransferScreen()),
          );
        }
        break;

      case VoiceCommandType.payBill:
        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const BillPaymentScreen()),
          );
        }
        break;

      case VoiceCommandType.viewTransactions:
        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(
                builder: (context) => const TransactionHistoryScreen()),
          );
        }
        break;

      case VoiceCommandType.applyLoan:
        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(
                builder: (context) => const LoansApplicationScreen()),
          );
        }
        break;

      case VoiceCommandType.openSavings:
        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const SavingsListScreen()),
          );
        }
        break;

      case VoiceCommandType.help:
        _showHelpDialog(voiceProvider.voiceService.selectedLocale);
        break;

      case VoiceCommandType.unknown:
        // Error message already handled in processCurrentCommand
        break;
    }

    // Clear the current command after handling
    voiceProvider.clearCommand();
  }

  void _showBalanceDialog() {
    final walletProvider = Provider.of<WalletProvider>(context, listen: false);
    final tenantProvider = Provider.of<TenantProvider>(context, listen: false);
    final wallet = walletProvider.wallet;
    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 2);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: tenantProvider.primaryColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.account_balance_wallet,
                color: tenantProvider.primaryColor,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            const Text(
              'Account Balance',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    tenantProvider.primaryColor,
                    tenantProvider.primaryColor.withOpacity(0.7),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: tenantProvider.primaryColor.withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Available Balance',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.white.withOpacity(0.9),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    wallet != null
                        ? currencyFormat.format(wallet.balance)
                        : '₦0.00',
                    style: const TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Divider(color: Colors.white.withOpacity(0.3)),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Account Number',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white.withOpacity(0.9),
                        ),
                      ),
                      Text(
                        wallet?.accountNumber ?? "N/A",
                        style: const TextStyle(
                          fontSize: 14,
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            style: TextButton.styleFrom(
              foregroundColor: tenantProvider.primaryColor,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            ),
            child: const Text(
              'Close',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  void _showHelpDialog(String currentLocale) {
    final tenantProvider = Provider.of<TenantProvider>(context, listen: false);
    final helpText = VoiceCommandParser.getHelpText(currentLocale);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: tenantProvider.primaryColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.help_outline,
                color: tenantProvider.primaryColor,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            Text(
              _getLocalizedTitle(currentLocale),
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: Container(
          constraints: const BoxConstraints(maxHeight: 450, maxWidth: 400),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, color: Colors.blue.shade700),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _getLocalizedInfoText(currentLocale),
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.blue.shade900,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: tenantProvider.primaryColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    helpText,
                    style: const TextStyle(
                      fontSize: 14,
                      fontFamily: 'monospace',
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            style: TextButton.styleFrom(
              backgroundColor: tenantProvider.primaryColor,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: Text(
              _getLocalizedButtonText(currentLocale),
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  String _getLocalizedTitle(String locale) {
    switch (locale) {
      case 'yo-NG':
        return 'Awọn Aṣẹ Ohùn';
      case 'ig-NG':
        return 'Iwu Olu';
      case 'ha-NG':
        return 'Umarnin Murya';
      default:
        return 'Voice Commands';
    }
  }

  String _getLocalizedInfoText(String locale) {
    switch (locale) {
      case 'yo-NG':
        return 'Tẹ igboohun lati sọ ọkan ninu awọn aṣẹ wọnyi';
      case 'ig-NG':
        return 'Pịa igwe okwu ka ị kwuo otu n\'ime iwu ndị a';
      case 'ha-NG':
        return 'Danna makirufo don faɗin ɗaya daga cikin waɗannan umarnin';
      default:
        return 'Tap the microphone and say one of these commands';
    }
  }

  String _getLocalizedButtonText(String locale) {
    switch (locale) {
      case 'yo-NG':
        return 'O dara';
      case 'ig-NG':
        return 'O di mma';
      case 'ha-NG':
        return 'Na gane';
      default:
        return 'Got it';
    }
  }

  String _getLocaleDisplayName(String locale) {
    switch (locale) {
      case 'yo-NG':
        return '🇳🇬 Yoruba';
      case 'ig-NG':
        return '🇳🇬 Igbo';
      case 'ha-NG':
        return '🇳🇬 Hausa';
      case 'en-NG':
        return '🇳🇬 English';
      default:
        return locale;
    }
  }

  String _getLocalizedListeningText(String locale) {
    switch (locale) {
      case 'yo-NG':
        return 'N gbọ...';
      case 'ig-NG':
        return 'Ana m ege ntị...';
      case 'ha-NG':
        return 'Ina saurare...';
      default:
        return 'Listening...';
    }
  }

  String _getLocalizedTapText(String locale) {
    switch (locale) {
      case 'yo-NG':
        return 'Tẹ igboohun lati sọrọ';
      case 'ig-NG':
        return 'Pịa igwe okwu ka ị kwuo okwu';
      case 'ha-NG':
        return 'Danna makirufo don yin magana';
      default:
        return 'Tap the microphone to speak';
    }
  }

  String _getLocalizedSpeakButton(String locale) {
    switch (locale) {
      case 'yo-NG':
        return 'Sọrọ';
      case 'ig-NG':
        return 'Kwuo';
      case 'ha-NG':
        return 'Yi magana';
      default:
        return 'Speak';
    }
  }

  String _getLocalizedStopButton(String locale) {
    switch (locale) {
      case 'yo-NG':
        return 'Duro';
      case 'ig-NG':
        return 'Kwụsị';
      case 'ha-NG':
        return 'Tsaya';
      default:
        return 'Stop';
    }
  }

  String _getLocalizedExecuteButton(String locale) {
    switch (locale) {
      case 'yo-NG':
        return 'Ṣe';
      case 'ig-NG':
        return 'Mee';
      case 'ha-NG':
        return 'Aiwatar';
      default:
        return 'Execute';
    }
  }

  String _getLocalizedConversation(String locale) {
    switch (locale) {
      case 'yo-NG':
        return 'Ibaraẹnisọrọ';
      case 'ig-NG':
        return 'Mkparịta ụka';
      case 'ha-NG':
        return 'Tattaunawa';
      default:
        return 'Conversation';
    }
  }

  String _getLocalizedClear(String locale) {
    switch (locale) {
      case 'yo-NG':
        return 'Paarẹ';
      case 'ig-NG':
        return 'Hichapụ';
      case 'ha-NG':
        return 'Share';
      default:
        return 'Clear';
    }
  }

  @override
  Widget build(BuildContext context) {
    final tenantProvider = Provider.of<TenantProvider>(context);

    return Scaffold(
      appBar: AppBar(
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.mic, size: 20),
            ),
            const SizedBox(width: 12),
            const Text(
              'Voice Banking',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            if (VoiceBankingConfig.useMockVoiceBanking)
              Container(
                margin: const EdgeInsets.only(left: 8),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.orange,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'MOCK',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
          ],
        ),
        backgroundColor: tenantProvider.primaryColor,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline),
            tooltip: 'Help',
            onPressed: () {
              final locale = Provider.of<VoiceBankingProvider>(context, listen: false)
                      .voiceService
                      .selectedLocale;
              _showHelpDialog(locale);
            },
          ),
        ],
      ),
      body: !_isInitialized
          ? _buildLoadingState()
          :  Consumer<VoiceBankingProvider>(
                  builder: (context, voiceProvider, child) {
                    return AnimatedBuilder(
                      animation: voiceProvider.voiceService,
                      builder: (context, _) => _buildVoiceInterface(
                          context, tenantProvider, voiceProvider),
                    );
                  },
                ),
    );
  }

  Widget _buildLoadingState() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.grey.shade50,
            Colors.white,
          ],
        ),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ScaleTransition(
              scale: _pulseAnimation,
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.blue.withOpacity(0.2),
                      blurRadius: 20,
                      spreadRadius: 5,
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.mic,
                  size: 64,
                  color: Colors.blue,
                ),
              ),
            ),
            const SizedBox(height: 32),
            const CircularProgressIndicator(),
            const SizedBox(height: 24),
            Text(
              VoiceBankingConfig.useMockVoiceBanking
                  ? 'Initializing Mock Voice Banking...'
                  : 'Initializing Voice Banking...',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Please wait while we set up your voice assistant',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey.shade600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVoiceInterface(BuildContext context,
      TenantProvider tenantProvider, dynamic voiceProvider) {
    final locales =
        List<String>.from(voiceProvider.voiceService.availableLocales);
    String selectedLocale = voiceProvider.voiceService.selectedLocale;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.black,
            Colors.black,
          ],
        ),
      ),
      child: SafeArea(
        child: Column(
          children: [
            // Language selector
            _buildLanguageSelector(
                locales, selectedLocale, tenantProvider, voiceProvider),

            // Voice profile selector
            _buildVoiceProfileSelector(tenantProvider, voiceProvider),

            // Voice visualizer
            Expanded(
              flex: 3,
              child: _buildVoiceVisualizer(
                  selectedLocale, tenantProvider, voiceProvider),
            ),

            // Conversation history
            if (voiceProvider.conversationHistory.isNotEmpty)
              Expanded(
                flex: 2,
                child: _buildConversationHistory(
                    selectedLocale, tenantProvider, voiceProvider),
              ),

            // Control buttons
            _buildControlButtons(selectedLocale, tenantProvider, voiceProvider),
          ],
        ),
      ),
    );
  }

  Widget _buildLanguageSelector(List<String> locales, String selectedLocale,
      TenantProvider tenantProvider, dynamic voiceProvider) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tenantProvider.primaryColor.withOpacity(0.2)),
        boxShadow: [
          BoxShadow(
            color: tenantProvider.primaryColor.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: tenantProvider.primaryColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.language,
              size: 24,
              color: tenantProvider.primaryColor,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: selectedLocale,
                isExpanded: true,
                dropdownColor: Colors.white,
                icon: Icon(
                  Icons.arrow_drop_down,
                  color: tenantProvider.primaryColor,
                ),
                style: const TextStyle(
                  fontSize: 16,
                  color: Colors.black87,
                  fontWeight: FontWeight.w600,
                ),
                items: locales.map<DropdownMenuItem<String>>((locale) {
                  return DropdownMenuItem<String>(
                    value: locale,
                    child: Text(
                      _getLocaleDisplayName(locale),
                      style: const TextStyle(
                        color: Colors.black87,
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  );
                }).toList(),
                onChanged: (locale) async {
                  if (locale != null && locale != selectedLocale) {
                    await voiceProvider.voiceService.setLocale(locale);

                    // Announce language change
                    String announcement;
                    switch (locale) {
                      case 'yo-NG':
                        announcement = 'Ede ti yipada si Yoruba';
                        break;
                      case 'ig-NG':
                        announcement = 'Asụsụ agbanweela na Igbo';
                        break;
                      case 'ha-NG':
                        announcement = 'An canza yare zuwa Hausa';
                        break;
                      default:
                        announcement = 'Language changed to English';
                    }

                    await voiceProvider.voiceService.speak(announcement);
                    _showSuccessSnackBar(announcement);
                  }
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVoiceProfileSelector(
      TenantProvider tenantProvider, dynamic voiceProvider) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tenantProvider.primaryColor.withOpacity(0.2)),
        boxShadow: [
          BoxShadow(
            color: tenantProvider.primaryColor.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: tenantProvider.primaryColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.record_voice_over,
              size: 24,
              color: tenantProvider.primaryColor,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<VoiceProfile?>(
                value: voiceProvider.selectedVoiceProfile,
                isExpanded: true,
                dropdownColor: Colors.white,
                hint: const Text(
                  'Select Voice Profile',
                  style: TextStyle(
                    color: Colors.black54,
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                icon: Icon(
                  Icons.arrow_drop_down,
                  color: tenantProvider.primaryColor,
                ),
                style: const TextStyle(
                  fontSize: 16,
                  color: Colors.black87,
                  fontWeight: FontWeight.w600,
                ),
                items: [
                  DropdownMenuItem<VoiceProfile?>(
                    value: null,
                    child: Text(
                      'Default Voice',
                      style: const TextStyle(
                        color: Colors.black87,
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  ...nigerianVoiceProfiles.map((profile) {
                    return DropdownMenuItem<VoiceProfile?>(
                      value: profile,
                      child: Row(
                        children: [
                          Icon(
                            profile.gender == 'male' ? Icons.man : Icons.woman,
                            size: 18,
                            color: Colors.grey.shade600,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            profile.name,
                            style: const TextStyle(
                              color: Colors.black87,
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
                onChanged: (profile) async {
                  await voiceProvider.setVoiceProfile(profile);
                  
                  // Auto-preview the voice
                  final previewText = _getVoicePreviewText(
                    voiceProvider.voiceService.selectedLocale,
                    profile,
                  );
                  await voiceProvider.voiceService.speak(previewText);
                  
                  _showSuccessSnackBar(
                    profile == null
                        ? 'Voice profile reset to default'
                        : 'Voice profile: ${profile.name}',
                  );
                },
              ),
            ),
          ),
          // Test voice button
          if (voiceProvider.selectedVoiceProfile != null)
            IconButton(
              icon: Icon(
                Icons.volume_up,
                color: tenantProvider.primaryColor,
              ),
              tooltip: 'Test Voice',
              onPressed: () async {
                final previewText = _getVoicePreviewText(
                  voiceProvider.voiceService.selectedLocale,
                  voiceProvider.selectedVoiceProfile,
                );
                await voiceProvider.voiceService.speak(previewText);
              },
            ),
        ],
      ),
    );
  }

  /// Get voice preview text based on locale and profile
  String _getVoicePreviewText(String locale, VoiceProfile? profile) {
    if (profile == null) {
      return 'Default voice activated';
    }
    
    final greetings = {
      'en-NG': 'Hello, I am your ${profile.gender} ${profile.accent} voice assistant.',
      'yo-NG': 'Kaabo, Emi ni oluranlowo ohun ${profile.gender} ${profile.accent} rẹ.',
      'ig-NG': 'Ndewo, Abụ m onye inyeaka olu ${profile.gender} ${profile.accent} gị.',
      'ha-NG': 'Sannu, Ni ne mataimaki murya ${profile.gender} ${profile.accent} ku.',
    };
    
    return greetings[locale] ?? greetings['en-NG']!;
  }

  Widget _buildVoiceVisualizer(String selectedLocale,
      TenantProvider tenantProvider, dynamic voiceProvider) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Microphone with glow effect
          AvatarGlow(
            animate: voiceProvider.voiceService.isListening,
            glowColor: tenantProvider.primaryColor,
            duration: const Duration(milliseconds: 2000),
            repeat: true,
            child: Material(
              elevation: 8.0,
              shape: const CircleBorder(),
              color: Colors.transparent,
              child: Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: voiceProvider.voiceService.isListening
                      ? LinearGradient(
                          colors: [
                            tenantProvider.primaryColor,
                            tenantProvider.primaryColor.withOpacity(0.7),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : null,
                  color: voiceProvider.voiceService.isListening
                      ? null
                      : tenantProvider.primaryColor,
                  boxShadow: [
                    BoxShadow(
                      color: tenantProvider.primaryColor.withOpacity(0.4),
                      blurRadius: 20,
                      spreadRadius: voiceProvider.voiceService.isListening
                          ? 5
                          : 0,
                    ),
                  ],
                ),
                child: CircleAvatar(
                  backgroundColor: Colors.transparent,
                  radius: 70,
                  child: Icon(
                    voiceProvider.voiceService.isListening
                        ? Icons.mic
                        : Icons.mic_none,
                    size: 70,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 32),

          // Status text
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            child: Text(
              voiceProvider.voiceService.isListening
                  ? _getLocalizedListeningText(selectedLocale)
                  : _getLocalizedTapText(selectedLocale),
              key: ValueKey(voiceProvider.voiceService.isListening),
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: voiceProvider.voiceService.isListening
                    ? tenantProvider.primaryColor
                    : Colors.white,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 24),

          // Recognized text
          if (voiceProvider.voiceService.lastWords.isNotEmpty)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 24),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    tenantProvider.primaryColor.withOpacity(0.1),
                    tenantProvider.primaryColor.withOpacity(0.05),
                  ],
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: tenantProvider.primaryColor.withOpacity(0.3),
                  width: 2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: tenantProvider.primaryColor.withOpacity(0.1),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.format_quote,
                        color: tenantProvider.primaryColor,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'You said:',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade700,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    voiceProvider.voiceService.lastWords,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: tenantProvider.primaryColor,
                      height: 1.4,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),

          // Confidence indicator
          if (voiceProvider.voiceService.confidenceLevel > 0)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.verified,
                    size: 16,
                    color: _getConfidenceColor(
                        voiceProvider.voiceService.confidenceLevel),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Confidence: ${(voiceProvider.voiceService.confidenceLevel * 100).toStringAsFixed(0)}%',
                    style: TextStyle(
                      fontSize: 13,
                      color: _getConfidenceColor(
                          voiceProvider.voiceService.confidenceLevel),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Color _getConfidenceColor(double confidence) {
    if (confidence >= 0.8) return Colors.green;
    if (confidence >= 0.6) return Colors.orange;
    return Colors.red;
  }

  Widget _buildConversationHistory(String selectedLocale,
      TenantProvider tenantProvider, dynamic voiceProvider) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(32),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Colors.grey.shade200),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(Icons.chat_bubble_outline,
                        color: tenantProvider.primaryColor, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      _getLocalizedConversation(selectedLocale),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                TextButton.icon(
                  onPressed: voiceProvider.clearHistory,
                  icon: const Icon(Icons.clear_all, size: 18),
                  label: Text(_getLocalizedClear(selectedLocale)),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.red.shade600,
                  ),
                ),
              ],
            ),
          ),

          // Messages
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: voiceProvider.conversationHistory.length,
              itemBuilder: (context, index) {
                final message = voiceProvider.conversationHistory[index];
                final isUser = message.startsWith('User:');
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Align(
                    alignment:
                        isUser ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      constraints: BoxConstraints(
                        maxWidth: MediaQuery.of(context).size.width * 0.75,
                      ),
                      decoration: BoxDecoration(
                        gradient: isUser
                            ? LinearGradient(
                                colors: [
                                  tenantProvider.primaryColor,
                                  tenantProvider.primaryColor.withOpacity(0.8),
                                ],
                              )
                            : null,
                        color: isUser ? null : Colors.white,
                        borderRadius: BorderRadius.only(
                          topLeft: const Radius.circular(16),
                          topRight: const Radius.circular(16),
                          bottomLeft:
                              Radius.circular(isUser ? 16 : 4),
                          bottomRight:
                              Radius.circular(isUser ? 4 : 16),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.08),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Text(
                        message.substring(message.indexOf(':') + 2),
                        style: TextStyle(
                          color: isUser ? Colors.white : Colors.black87,
                          fontSize: 14,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildControlButtons(String selectedLocale,
      TenantProvider tenantProvider, dynamic voiceProvider) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          // Microphone button
          Expanded(
            child: ElevatedButton.icon(
              onPressed: voiceProvider.voiceService.isListening
                  ? () async {
                      debugPrint('🛑 Stop button pressed');
                      await voiceProvider.stopListening();
                      debugPrint('✅ Stop listening completed');
                      
                      // Give a moment for the state to update on mobile
                      await Future.delayed(const Duration(milliseconds: 200));
                      
                      debugPrint('📋 Current command: ${voiceProvider.currentCommand}');
                      debugPrint('📋 Command type: ${voiceProvider.currentCommand?.type}');
                      if (voiceProvider.currentCommand != null) {
                        debugPrint('🎯 Handling voice command...');
                        await _handleVoiceCommand(voiceProvider);
                      } else {
                        debugPrint('⚠️ No command to handle!');
                      }
                    }
                  : voiceProvider.startListening,
              icon: Icon(
                voiceProvider.voiceService.isListening
                    ? Icons.stop_rounded
                    : Icons.mic_rounded,
                size: 24,
              ),
              label: Text(
                voiceProvider.voiceService.isListening
                    ? _getLocalizedStopButton(selectedLocale)
                    : _getLocalizedSpeakButton(selectedLocale),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: voiceProvider.voiceService.isListening
                    ? Colors.red.shade600
                    : tenantProvider.primaryColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 28,
                  vertical: 18,
                ),
                elevation: 4,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),

          // Execute command button
          if (voiceProvider.currentCommand != null &&
              !voiceProvider.voiceService.isListening) ...[
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: voiceProvider.isProcessing
                    ? null
                    : () => _handleVoiceCommand(voiceProvider),
                icon: voiceProvider.isProcessing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor:
                              AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Icon(Icons.check_circle_rounded, size: 24),
                label: Text(
                  _getLocalizedExecuteButton(selectedLocale),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green.shade600,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 28,
                    vertical: 18,
                  ),
                  elevation: 4,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  disabledBackgroundColor: Colors.grey.shade400,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}