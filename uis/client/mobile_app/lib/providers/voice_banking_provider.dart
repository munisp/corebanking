import 'package:flutter/foundation.dart';
import '../services/voice_banking_service.dart';
import '../services/voice_command_parser.dart';
import '../models/voice_profile.dart';

class VoiceBankingProvider extends ChangeNotifier {
  final VoiceBankingService voiceService = VoiceBankingService();
  
  VoiceCommand? _currentCommand;
  bool _isProcessing = false;
  String? _errorMessage;
  final List<String> _conversationHistory = [];
  VoiceProfile? _selectedVoiceProfile;

  // Getters
  VoiceCommand? get currentCommand => _currentCommand;
  bool get isProcessing => _isProcessing;
  String? get errorMessage => _errorMessage;
  List<String> get conversationHistory => _conversationHistory;
  VoiceProfile? get selectedVoiceProfile => _selectedVoiceProfile;

  /// Initialize voice banking service
  Future<bool> initialize() async {
    try {
      // Set up callback for automatic command processing on final result
      voiceService.onFinalResult = () async {
        debugPrint('🎯 Final result callback triggered!');
        // Wait a bit for the service to complete stopping
        await Future.delayed(const Duration(milliseconds: 500));
        await _processFinalResult();
      };
      
      final success = await voiceService.initialize();
      if (!success) {
        _errorMessage = 'Failed to initialize voice banking';
      }
      
      // Ensure YarnGPT TTS is enabled (force it to be true)
      voiceService.setYarnGptTtsEnabled(true);
      debugPrint('✅ Voice banking initialized - YarnGPT TTS: ${voiceService.useYarnGptTts}');
      
      notifyListeners();
      return success;
    } catch (e) {
      _errorMessage = 'Error: $e';
      notifyListeners();
      return false;
    }
  }

  /// Start listening for voice commands
  Future<void> startListening() async {
    try {
      _errorMessage = null;
      await voiceService.startListening();
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to start listening: $e';
      notifyListeners();
    }
  }

  /// Process final result when it arrives
  Future<void> _processFinalResult() async {
    try {
      // Parse the command using the CURRENT locale
      if (voiceService.lastCommand.isNotEmpty) {
        debugPrint('🎤 Processing final result: "${voiceService.lastCommand}"');
        debugPrint('🌍 Current locale: ${voiceService.selectedLocale}');
        debugPrint('🎙️ Voice profile: ${_selectedVoiceProfile?.name ?? "default"}');
        
        // Use traditional parser
        _currentCommand = VoiceCommandParser.parseCommand(
          voiceService.lastCommand,
          confidence: voiceService.confidenceLevel,
          locale: voiceService.selectedLocale,
        );
        
        debugPrint('📋 Parsed command type: ${_currentCommand?.type}');
        debugPrint('📋 Parsed command params: ${_currentCommand?.parameters}');
        
        // Add to conversation history
        _conversationHistory.add('User: ${voiceService.lastCommand}');
        
        notifyListeners();
      } else {
        debugPrint('⚠️ No command to process');
      }
    } catch (e) {
      _errorMessage = 'Failed to process result: $e';
      debugPrint('❌ Error in _processFinalResult: $e');
      notifyListeners();
    }
  }

  /// Stop listening
  Future<void> stopListening() async {
    try {
      await voiceService.stopListening();
      
      // Wait for the final result callback to fire (increased delay for mobile devices)
      // Mobile devices often need more time to process final results
      await Future.delayed(const Duration(milliseconds: 800));
      
      // Parse the command using the CURRENT locale
      if (voiceService.lastCommand.isNotEmpty) {
        debugPrint('🎤 Last command: "${voiceService.lastCommand}"');
        debugPrint('🌍 Current locale: ${voiceService.selectedLocale}');
        
        // ⚠️ CRITICAL FIX: Pass the current locale to parseCommand
        // This was the bug - it was using default 'en-NG' instead of selectedLocale
        _currentCommand = VoiceCommandParser.parseCommand(
          voiceService.lastCommand,
          confidence: voiceService.confidenceLevel,
          locale: voiceService.selectedLocale, // ← THE FIX IS HERE!
        );
        
        debugPrint('📋 Parsed command type: ${_currentCommand?.type}');
        debugPrint('📋 Parsed command params: ${_currentCommand?.parameters}');
        
        // Add to conversation history
        _conversationHistory.add('User: ${voiceService.lastCommand}');
      } else {
        debugPrint('⚠️ No command captured after stopping');
      }
      
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to stop listening: $e';
      debugPrint('❌ Error in stopListening: $e');
      notifyListeners();
    }
  }

  /// Process the current command
  Future<void> processCurrentCommand() async {
    if (_currentCommand == null) return;

    _isProcessing = true;
    notifyListeners();

    try {
      String response;
      
      switch (_currentCommand!.type) {
        case VoiceCommandType.checkBalance:
          response = _getLocalizedResponse('balance', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.transfer:
          response = _getLocalizedResponse('transfer', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.payBill:
          response = _getLocalizedResponse('bill', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.viewTransactions:
          response = _getLocalizedResponse('transactions', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.applyLoan:
          response = _getLocalizedResponse('loan', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.openSavings:
          response = _getLocalizedResponse('savings', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.viewLpos:
          response = _getLocalizedResponse('lpos', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.viewAgriculture:
          response = _getLocalizedResponse('agriculture', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.viewInsurance:
          response = _getLocalizedResponse('insurance', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.viewBankStatement:
          response = _getLocalizedResponse('bank_statement', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.viewCarbonCredits:
          response = _getLocalizedResponse('carbon_credits', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.viewCards:
          response = _getLocalizedResponse('cards', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.viewEscrow:
          response = _getLocalizedResponse('escrow', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.viewMortgage:
          response = _getLocalizedResponse('mortgage', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.viewEducation:
          response = _getLocalizedResponse('education', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.viewEsusu:
          response = _getLocalizedResponse('esusu', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.viewVirtualAccounts:
          response = _getLocalizedResponse('virtual_accounts', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.help:
          response = _getLocalizedResponse('help', voiceService.selectedLocale);
          break;
          
        case VoiceCommandType.unknown:
          response = _getLocalizedResponse('unknown', voiceService.selectedLocale);
          _errorMessage = response;
          break;
      }

      _conversationHistory.add('Assistant: $response');
      debugPrint('🔊 Speaking: $response (locale: ${voiceService.selectedLocale})');
      await voiceService.speak(response);
      
    } catch (e) {
      _errorMessage = 'Error processing command: $e';
      debugPrint('❌ Error processing command: $e');
      final errorResponse = _getLocalizedResponse('error', voiceService.selectedLocale);
      await voiceService.speak(errorResponse);
    } finally {
      _isProcessing = false;
      notifyListeners();
    }
  }

  String _getLocalizedResponse(String type, String locale) {
    final responses = {
      'en-NG': {
        // 'balance': 'Opening your account balance...',
        'transfer': 'Opening transfer screen...',
        // 'bill': 'Opening bill payment...',
        'transactions': 'Opening transaction history...',
        'loan': 'Opening loan application...',
        'savings': 'Opening savings account...',
        'lpos': 'Opening local purchase orders...',
        'agriculture': 'Opening agriculture banking...',
        'insurance': 'Opening insurance...',
        'bank_statement': 'Opening bank statement...',
        'carbon_credits': 'Opening carbon credits...',
        'cards': 'Opening cards...',
        'escrow': 'Opening escrow accounts...',
        'mortgage': 'Opening mortgage...',
        'education': 'Opening education banking...',
        'esusu': 'Opening esusu...',
        // 'virtual_accounts': 'Opening virtual accounts...',
        'help': 'Here are the available commands...',
        'unknown': 'I did not understand that command. Say "help" to see what I can do.',
        'error': 'An error occurred. Please try again.',
      },
      'yo-NG': {
        // 'balance': 'N ṣi iwontunwonsi rẹ...',
        'transfer': 'N ṣi oju-iwe firanṣẹ...',
        // 'bill': 'N ṣi sisanwo owo...',
        'transactions': 'N ṣi itan iṣowo...',
        'loan': 'N ṣi ibeere awin...',
        'savings': 'N ṣi akaunt fipamọ...',
        'lpos': 'N ṣi awọn aṣẹ rira...',
        'agriculture': 'N ṣi iṣowo ọgbin...',
        'insurance': 'N ṣi iṣeduro...',
        'bank_statement': 'N ṣi alaye banki...',
        'carbon_credits': 'N ṣi awọn kirẹditi erogba...',
        'cards': 'N ṣi awọn kaadi...',
        'escrow': 'N ṣi akaunt escrow...',
        'mortgage': 'N ṣi awin ile...',
        'education': 'N ṣi iṣowo ẹkọ...',
        'esusu': 'N ṣi esusu...',
        // 'virtual_accounts': 'N ṣi awọn akaunt foju...',
        'help': 'Eyi ni awọn aṣẹ to wa...',
        'unknown': 'Mi o ye aṣẹ yẹn. Sọ "iranlọwọ" lati mọ ohun ti mo le ṣe.',
        'error': 'Aṣiṣe kan waye. Jọwọ gbiyanju lẹẹkansi.',
      },
      'ig-NG': {
        // 'balance': 'Ana m emepe nguzozi gị...',
        'transfer': 'Ana m emepe ebe ịzipu ego...',
        // 'bill': 'Ana m emepe ịkwụ ụgwọ...',
        'transactions': 'Ana m emepe akụkọ azụmahịa...',
        'loan': 'Ana m emepe arịrịọ mgbazinye...',
        'savings': 'Ana m emepe akaụntụ nchekwa...',
        'lpos': 'Ana m emepe iwu ịzụta...',
        'agriculture': 'Ana m emepe ụlọ akụ ọrụ ugbo...',
        'insurance': 'Ana m emepe mkpuchi...',
        'bank_statement': 'Ana m emepe nkọwa akụkọ ụlọ akụ...',
        'carbon_credits': 'Ana m emepe kredit carbon...',
        'cards': 'Ana m emepe kaadị...',
        'escrow': 'Ana m emepe akaụntụ escrow...',
        'mortgage': 'Ana m emepe mgbazinye ụlọ...',
        'education': 'Ana m emepe ụlọ akụ agụmakwụkwọ...',
        'esusu': 'Ana m emepe esusu...',
        // 'virtual_accounts': 'Ana m emepe akaụntụ nke mbara...',
        'help': 'Nke a bụ iwu dị...',
        'unknown': 'Aghọtaghị m iwu ahụ. Sị "enyemaka" ịmata ihe m nwere ike ime.',
        'error': 'Njehie mere. Biko nwaa ọzọ.',
      },
      'ha-NG': {
        // 'balance': 'Ina buɗe ragowar ku...',
        'transfer': 'Ina buɗe shafin turawa...',
        // 'bill': 'Ina buɗe biyan kuɗi...',
        'transactions': 'Ina buɗe tarihin ma\'amaloli...',
        'loan': 'Ina buɗe neman aron...',
        'savings': 'Ina buɗe asusun ajiya...',
        'lpos': 'Ina buɗe umarnin saye...',
        'agriculture': 'Ina buɗe bankin noma...',
        'insurance': 'Ina buɗe inshora...',
        'bank_statement': 'Ina buɗe bayanan banki...',
        'carbon_credits': 'Ina buɗe credit carbon...',
        'cards': 'Ina buɗe katunan...',
        'escrow': 'Ina buɗe asusun escrow...',
        'mortgage': 'Ina buɗe lamunin gida...',
        'education': 'Ina buɗe bankin ilimi...',
        'esusu': 'Ina buɗe esusu...',
        // 'virtual_accounts': 'Ina buɗe asusun kama-da-wane...',
        'help': 'Ga nan umarnin da ake da su...',
        'unknown': 'Ban fahimci wannan umarnin ba. Ka faɗi "taimako" don sanin abin da zan iya yi.',
        'error': 'Kuskure ya faru. Da fatan sake gwadawa.',
      },
    };

    return responses[locale]?[type] ?? responses['en-NG']![type]!;
  }

  /// Set voice profile for accent-specific processing
  void setVoiceProfile(VoiceProfile? profile) async {
    _selectedVoiceProfile = profile;
    
    // Apply to voice service for TTS voice output
    await voiceService.setVoiceProfile(profile);
    
    // Ensure YarnGPT TTS is enabled when a profile is set
    if (profile != null) {
      voiceService.setYarnGptTtsEnabled(true);
    }
    
    debugPrint('🎙️ Voice profile updated: ${profile?.name ?? "default"}');
    debugPrint('🎙️ YarnGPT TTS enabled: ${voiceService.useYarnGptTts}');
    notifyListeners();
  }
  
  /// Clear current command
  void clearCommand() {
    _currentCommand = null;
    _errorMessage = null;
    voiceService.clearCommand();
    notifyListeners();
  }

  /// Clear conversation history
  void clearHistory() {
    _conversationHistory.clear();
    notifyListeners();
  }

  @override
  void dispose() {
    voiceService.dispose();
    super.dispose();
  }
}