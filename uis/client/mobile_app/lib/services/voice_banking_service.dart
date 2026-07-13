import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:audioplayers/audioplayers.dart';
import '../models/voice_profile.dart';
import '../services/yarngpt_service.dart';
import '../config/yarngpt_config.dart';

class VoiceBankingService extends ChangeNotifier {
  final SpeechToText _speechToText = SpeechToText();
  final FlutterTts _flutterTts = FlutterTts();
  final YarnGPTService _yarnGptService = YarnGPTService();
  final AudioPlayer _audioPlayer = AudioPlayer();
  bool _useYarnGptTts = YarnGPTConfig.enabledByDefault; // Works on all platforms (API call)

  bool _isListening = false;
  bool _isInitialized = false;
  bool _isSpeaking = false;
  String _lastWords = '';
  String _lastCommand = '';
  double _confidenceLevel = 0.0;
  Completer<void>? _finalResultCompleter;
  
  // Callback when final result is received
  Function()? onFinalResult;

  // Static available locales for Nigeria
  static const List<String> _staticLocales = [
    'en-NG', // English (Nigeria)
    'yo-NG', // Yoruba
    'ig-NG', // Igbo
    'ha-NG', // Hausa
  ];
  
  // Map locales to TTS language codes
  static const Map<String, String> _ttsLanguageMap = {
    'en-NG': 'en-NG',
    'yo-NG': 'yo-NG', // Yoruba - fallback to en-NG if not available
    'ig-NG': 'ig-NG', // Igbo - fallback to en-NG if not available
    'ha-NG': 'ha-NG', // Hausa - fallback to en-NG if not available
  };
  
  List<String> _availableLocales = List.from(_staticLocales);
  String _selectedLocale = 'en-NG';
  List<dynamic> _availableTtsLanguages = [];
  List<dynamic> _availableTtsVoices = [];
  VoiceProfile? _selectedVoiceProfile;

  // Getters
  bool get isListening => _isListening;
  bool get isInitialized => _isInitialized;
  bool get isSpeaking => _isSpeaking;
  String get lastWords => _lastWords;
  String get lastCommand => _lastCommand;
  double get confidenceLevel => _confidenceLevel;
  List<String> get availableLocales => _availableLocales;
  String get selectedLocale => _selectedLocale;
  VoiceProfile? get selectedVoiceProfile => _selectedVoiceProfile;
  List<dynamic> get availableTtsVoices => _availableTtsVoices;
  bool get useYarnGptTts => _useYarnGptTts;

  VoiceBankingService() {
    debugPrint('🎯 VoiceBankingService created');
    debugPrint('   YarnGPTConfig.enabledByDefault = ${YarnGPTConfig.enabledByDefault}');
    debugPrint('   _useYarnGptTts = $_useYarnGptTts');
    _initializeTts();
  }

  /// Initialize speech recognition
  Future<bool> initialize() async {
    if (_isInitialized) return true;
    try {
      // Request microphone permission
      final status = await Permission.microphone.request();
      if (!status.isGranted) {
        debugPrint('Microphone permission denied');
        return false;
      }
      
      // Initialize speech to text
      _isInitialized = await _speechToText.initialize(
        onError: (error) {
          debugPrint('Speech recognition error: ${error.errorMsg}');
          _isListening = false;
          notifyListeners();
        },
        onStatus: (status) {
          debugPrint('Speech recognition status: $status');
          if (status == 'done' || status == 'notListening') {
            _isListening = false;
            notifyListeners();
          }
        },
      );
      
      // Use static locales
      _availableLocales = List.from(_staticLocales);
      
      // Get available TTS languages and voices
      await _getAvailableTtsLanguages();
      await _getAvailableTtsVoices();
      
      // Set default YarnGPT voice profile if enabled
      if (_useYarnGptTts && _selectedVoiceProfile == null && nigerianVoiceProfiles.isNotEmpty) {
        _selectedVoiceProfile = nigerianVoiceProfiles.first; // Idera by default
        _yarnGptService.setVoiceProfile(_selectedVoiceProfile!);
        debugPrint('🎙️ Default YarnGPT voice profile set: ${_selectedVoiceProfile!.name}');
      }
      
      debugPrint('Voice banking initialized with locales: $_availableLocales');
      debugPrint('Available TTS languages: $_availableTtsLanguages');
      debugPrint('Available TTS voices: ${_availableTtsVoices.length}');
      debugPrint('YarnGPT TTS enabled: $_useYarnGptTts');
      debugPrint('YarnGPT voice: ${_selectedVoiceProfile?.name ?? "none"}');
      
      notifyListeners();
      return _isInitialized;
    } catch (e) {
      debugPrint('Failed to initialize voice banking: $e');
      return false;
    }
  }

  /// Get available TTS languages
  Future<void> _getAvailableTtsLanguages() async {
    try {
      final languages = await _flutterTts.getLanguages;
      if (languages != null) {
        _availableTtsLanguages = languages;
        debugPrint('TTS supports ${languages.length} languages');
      }
    } catch (e) {
      debugPrint('Failed to get TTS languages: $e');
      _availableTtsLanguages = [];
    }
  }

  /// Get available TTS voices
  Future<void> _getAvailableTtsVoices() async {
    try {
      final voices = await _flutterTts.getVoices;
      if (voices != null) {
        _availableTtsVoices = voices;
        debugPrint('TTS supports ${voices.length} voices');
        
        // Log sample voices for debugging
        if (voices.isNotEmpty && voices.length > 0) {
          debugPrint('Sample voices: ${voices.take(3).toList()}');
        }
      }
    } catch (e) {
      debugPrint('Failed to get TTS voices: $e');
      _availableTtsVoices = [];
    }
  }

  /// Initialize text to speech
  Future<void> _initializeTts() async {
    try {
      // Set initial language
      await _setTtsLanguage(_selectedLocale);
      
      // Configure TTS settings (will be adjusted by voice profile)
      await _flutterTts.setSpeechRate(0.5);
      await _flutterTts.setVolume(1.0);
      await _flutterTts.setPitch(1.0);

      _flutterTts.setStartHandler(() {
        _isSpeaking = true;
        notifyListeners();
      });

      _flutterTts.setCompletionHandler(() {
        _isSpeaking = false;
        notifyListeners();
      });

      _flutterTts.setErrorHandler((msg) {
        _isSpeaking = false;
        notifyListeners();
        debugPrint('TTS Error: $msg');
      });
    } catch (e) {
      debugPrint('Failed to initialize TTS: $e');
    }
  }

  /// Set TTS language with fallback
  Future<void> _setTtsLanguage(String locale) async {
    try {
      String ttsLanguage = _ttsLanguageMap[locale] ?? 'en-NG';
      
      // Try to set the requested language
      var result = await _flutterTts.setLanguage(ttsLanguage);
      
      // If the language is not available, try fallback options
      if (result == 0) {
        debugPrint('Language $ttsLanguage not available, trying fallbacks...');
        
        // Try without region code (e.g., 'yo' instead of 'yo-NG')
        final langCode = locale.split('-')[0];
        result = await _flutterTts.setLanguage(langCode);
        
        if (result == 0) {
          // Final fallback to English
          debugPrint('Fallback to English (en-US)');
          await _flutterTts.setLanguage('en-US');
        } else {
          debugPrint('Successfully set TTS language to: $langCode');
        }
      } else {
        debugPrint('Successfully set TTS language to: $ttsLanguage');
      }
    } catch (e) {
      debugPrint('Failed to set TTS language: $e');
      // Fallback to English on error
      await _flutterTts.setLanguage('en-US');
    }
  }

  /// Start listening to voice commands
  Future<void> startListening() async {
    if (!_isInitialized) {
      final initialized = await initialize();
      if (!initialized) return;
    }

    if (_isListening) return;

    try {
      _lastWords = '';
      _lastCommand = ''; // Clear previous command
      _confidenceLevel = 0.0;
      _finalResultCompleter = Completer<void>(); // Create completer for final result
      notifyListeners();

      // Verify the locale is available
      final localeToUse = _availableLocales.contains(_selectedLocale) 
          ? _selectedLocale 
          : 'en-NG';
      
      debugPrint('Starting to listen with locale: $localeToUse');

      await _speechToText.listen(
        onResult: (result) {
          _lastWords = result.recognizedWords;
          _confidenceLevel = result.confidence;

          if (result.finalResult) {
            _lastCommand = result.recognizedWords;
            debugPrint('Final result: $_lastCommand (confidence: $_confidenceLevel)');
            // Complete the future when we get final result
            if (_finalResultCompleter != null && !_finalResultCompleter!.isCompleted) {
              _finalResultCompleter!.complete();
            }
            // Notify that final result is ready for processing
            if (onFinalResult != null) {
              debugPrint('🔔 Triggering onFinalResult callback');
              onFinalResult!();
            }
          } else {
            debugPrint('Partial result: $_lastWords');
          }

          notifyListeners();
        },
        localeId: localeToUse,
        listenOptions: SpeechListenOptions(
          listenMode: ListenMode.confirmation,
          cancelOnError: true,
          partialResults: true,
        ),
      );

      _isListening = true;
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to start listening: $e');
      _isListening = false;
      notifyListeners();
    }
  }

  /// Stop listening
  Future<void> stopListening() async {
    if (!_isListening) return;

    try {
      await _speechToText.stop();
      _isListening = false;
      notifyListeners();
      debugPrint('Stopped listening');
      
      // Wait for final result with timeout
      if (_finalResultCompleter != null && !_finalResultCompleter!.isCompleted) {
        debugPrint('⏳ Waiting for final result...');
        await _finalResultCompleter!.future.timeout(
          const Duration(seconds: 2),
          onTimeout: () {
            debugPrint('⚠️ Timeout waiting for final result');
          },
        );
        debugPrint('✅ Final result received!');
      }
    } catch (e) {
      debugPrint('Failed to stop listening: $e');
    }
  }

  /// Speak a response
  Future<void> speak(String text) async {
    try {
      if (_isSpeaking) {
        await _flutterTts.stop();
        await _audioPlayer.stop();
      }
      
      _isSpeaking = true;
      notifyListeners();
      
      // Log TTS configuration
      debugPrint('🔊 TTS Request:');
      debugPrint('   Text: $text');
      debugPrint('   YarnGPT enabled: $_useYarnGptTts');
      debugPrint('   Voice profile: ${_selectedVoiceProfile?.name ?? "none"}');
      debugPrint('   YarnGPT voice: ${_selectedVoiceProfile?.yarnGptVoice ?? "none"}');
      
      // Use YarnGPT TTS if enabled and profile is selected
      if (_useYarnGptTts && _selectedVoiceProfile != null && _selectedVoiceProfile!.yarnGptVoice != null) {
        debugPrint('🎙️ Using YarnGPT TTS: ${_selectedVoiceProfile!.yarnGptVoice}');
        
        final audioData = await _yarnGptService.textToSpeech(
          text: text,
          profile: _selectedVoiceProfile,
        );
        
        if (audioData != null) {
          debugPrint('✅ YarnGPT TTS audio received: ${audioData.length} bytes');
          // Play audio from bytes
          await _audioPlayer.play(BytesSource(audioData));
          
          // Wait for completion
          final completer = Completer<void>();
          _audioPlayer.onPlayerComplete.listen((_) {
            if (!completer.isCompleted) completer.complete();
          });
          await completer.future.timeout(
            Duration(seconds: 30),
            onTimeout: () {
              debugPrint('⚠️ YarnGPT TTS playback timeout');
            },
          );
          
          _isSpeaking = false;
          notifyListeners();
          debugPrint('✅ YarnGPT TTS playback completed');
          return;
        } else {
          debugPrint('⚠️ YarnGPT TTS returned no audio data, falling back to Flutter TTS');
        }
      } else {
        debugPrint('ℹ️ Using Flutter TTS (YarnGPT conditions not met)');
      }
      
      // Fallback to Flutter TTS
      debugPrint('🔊 Speaking with Flutter TTS: $text (locale: $_selectedLocale)');
      await _flutterTts.speak(text);
      _isSpeaking = false;
      notifyListeners();
    } catch (e) {
      debugPrint('❌ Failed to speak: $e');
      _isSpeaking = false;
      notifyListeners();
    }
  }

  /// Stop speaking
  Future<void> stopSpeaking() async {
    try {
      await _flutterTts.stop();
      await _audioPlayer.stop();
      _isSpeaking = false;
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to stop speaking: $e');
    }
  }

  /// Change locale
  Future<void> setLocale(String locale) async {
    if (!_availableLocales.contains(locale)) {
      debugPrint('Locale $locale not available');
      return;
    }
    
    _selectedLocale = locale;
    await _setTtsLanguage(locale);
    
    debugPrint('Locale changed to: $locale');
    notifyListeners();
  }

  /// Set voice profile for TTS
  Future<void> setVoiceProfile(VoiceProfile? profile) async {
    _selectedVoiceProfile = profile;
    
    if (profile == null) {
      // Reset to default voice settings
      await _flutterTts.setPitch(1.0);
      await _flutterTts.setSpeechRate(0.5);
      debugPrint('🎙️ Voice profile reset to default');
    } else {
      // Set YarnGPT voice profile
      _yarnGptService.setVoiceProfile(profile);
      
      // Also adjust Flutter TTS settings as fallback
      await _applyVoiceProfileSettings(profile);
      debugPrint('🎙️ Voice profile applied: ${profile.name} (YarnGPT: ${profile.yarnGptVoice})');
    }
    
    notifyListeners();
  }

  /// Enable or disable YarnGPT TTS
  void setYarnGptTtsEnabled(bool enabled) {
    _useYarnGptTts = enabled;
    debugPrint('🎙️ YarnGPT TTS ${enabled ? "enabled" : "disabled"}');
    
    // If enabling and no profile is set, set default
    if (enabled && _selectedVoiceProfile == null && nigerianVoiceProfiles.isNotEmpty) {
      _selectedVoiceProfile = nigerianVoiceProfiles.first;
      _yarnGptService.setVoiceProfile(_selectedVoiceProfile!);
      debugPrint('🎙️ Default YarnGPT voice profile set: ${_selectedVoiceProfile!.name}');
    }
    
    notifyListeners();
  }

  /// Apply voice profile settings to TTS
  Future<void> _applyVoiceProfileSettings(VoiceProfile profile) async {
    try {
      // Adjust pitch based on gender
      // Male voices: 0.7-0.9, Female voices: 1.1-1.3
      double pitch = profile.gender == 'male' ? 0.8 : 1.2;
      await _flutterTts.setPitch(pitch);
      
      // Adjust rate slightly based on accent
      double rate = 0.5; // Default
      switch (profile.accent) {
        case 'lagos':
          rate = 0.55; // Slightly faster for Lagos accent
          break;
        case 'hausa':
          rate = 0.48; // Slightly slower for Hausa
          break;
        default:
          rate = 0.5;
      }
      await _flutterTts.setSpeechRate(rate);
      
      // Try to find and set a matching TTS voice
      await _selectMatchingVoice(profile);
      
      debugPrint('🎛️ TTS Settings - Pitch: $pitch, Rate: $rate, Gender: ${profile.gender}, Accent: ${profile.accent}');
    } catch (e) {
      debugPrint('Failed to apply voice profile settings: $e');
    }
  }

  /// Select a matching TTS voice based on profile
  Future<void> _selectMatchingVoice(VoiceProfile profile) async {
    try {
      if (_availableTtsVoices.isEmpty) {
        await _getAvailableTtsVoices();
      }
      
      if (_availableTtsVoices.isEmpty) {
        debugPrint('No TTS voices available');
        return;
      }
      
      // Get current language code
      String langCode = _selectedLocale.split('-')[0]; // e.g., 'en' from 'en-NG'
      
      // Try to find a voice matching gender and language
      String genderKeyword = profile.gender == 'male' ? 'male' : 'female';
      
      // Search for matching voice
      var matchingVoice = _availableTtsVoices.firstWhere(
        (voice) {
          if (voice is Map) {
            String voiceName = (voice['name'] ?? '').toString().toLowerCase();
            String voiceLang = (voice['locale'] ?? '').toString().toLowerCase();
            
            // Check if voice matches language and gender
            bool langMatch = voiceLang.startsWith(langCode) || voiceLang.contains('en');
            bool genderMatch = voiceName.contains(genderKeyword) ||
                             voiceName.contains(profile.gender == 'male' ? 'man' : 'woman');
            
            return langMatch && genderMatch;
          }
          return false;
        },
        orElse: () => _availableTtsVoices.firstWhere(
          (voice) {
            if (voice is Map) {
              String voiceLang = (voice['locale'] ?? '').toString().toLowerCase();
              return voiceLang.startsWith(langCode) || voiceLang.contains('en');
            }
            return false;
          },
          orElse: () => null,
        ),
      );
      
      if (matchingVoice != null && matchingVoice is Map) {
        String voiceName = matchingVoice['name'] ?? '';
        if (voiceName.isNotEmpty) {
          await _flutterTts.setVoice({"name": voiceName, "locale": matchingVoice['locale']});
          debugPrint('🗣️ Selected TTS voice: $voiceName (${matchingVoice['locale']})');
        }
      } else {
        debugPrint('⚠️ No matching voice found for ${profile.gender} ${profile.accent}');
      }
    } catch (e) {
      debugPrint('Error selecting matching voice: $e');
    }
  }

  /// Clear last command
  void clearCommand() {
    _lastCommand = '';
    _lastWords = '';
    _confidenceLevel = 0.0;
    notifyListeners();
  }

  @override
  void dispose() {
    _speechToText.cancel();
    _flutterTts.stop();
    _audioPlayer.dispose();
    super.dispose();
  }
}