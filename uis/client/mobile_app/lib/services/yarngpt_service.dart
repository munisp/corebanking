import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/voice_profile.dart';
import '../config/yarngpt_config.dart';

/// YarnGPT TTS Service for Nigerian accented text-to-speech
/// Integrates with YarnGPT API to provide natural Nigerian voice synthesis
/// Works on all platforms (mobile, web, desktop) via HTTP API calls
class YarnGPTService {
  final String apiKey;
  final String baseUrl;
  
  VoiceProfile? _selectedProfile;
  
  YarnGPTService({
    String? apiKey,
    String? baseUrl,
  })  : apiKey = apiKey ?? YarnGPTConfig.apiKey,
        baseUrl = baseUrl ?? 'https://yarngpt.ai/api/v1';
  
  /// Get current voice profile
  VoiceProfile? get selectedProfile => _selectedProfile;
  
  /// Set voice profile for TTS
  void setVoiceProfile(VoiceProfile profile) {
    _selectedProfile = profile;
    debugPrint('🎙️ YarnGPT voice profile set to: ${profile.name}');
  }
  
  /// Convert text to speech using YarnGPT TTS API
  /// Returns audio data as bytes that can be played
  Future<Uint8List?> textToSpeech({
    required String text,
    VoiceProfile? profile,
    String responseFormat = 'mp3',
  }) async {
    try {
      if (text.isEmpty) {
        debugPrint('⚠️ Cannot convert empty text to speech');
        return null;
      }
      
      if (text.length > 2000) {
        debugPrint('⚠️ Text exceeds 2000 character limit, truncating');
        text = text.substring(0, 2000);
      }
      
      final activeProfile = profile ?? _selectedProfile;
      final voiceName = activeProfile?.yarnGptVoice ?? 'Idera';
      
      final requestBody = {
        'text': text,
        'voice': voiceName,
        'response_format': responseFormat,
      };
      
      final endpoint = '$baseUrl/tts';
      
      debugPrint('🗣️ YarnGPT TTS Request:');
      debugPrint('   Endpoint: $endpoint');
      debugPrint('   Text: "$text"');
      debugPrint('   Voice: $voiceName');
      debugPrint('   Format: $responseFormat');
      debugPrint('   API Key: ${apiKey.substring(0, 10)}...');
      
      final response = await http.post(
        Uri.parse(endpoint),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $apiKey',
        },
        body: jsonEncode(requestBody),
      ).timeout(const Duration(seconds: 30));
      
      debugPrint('📡 YarnGPT TTS Response:');
      debugPrint('   Status: ${response.statusCode}');
      debugPrint('   Body length: ${response.bodyBytes.length} bytes');
      
      if (response.statusCode == 200) {
        debugPrint('✅ YarnGPT TTS successful (${response.bodyBytes.length} bytes)');
        return response.bodyBytes;
      } else {
        debugPrint('❌ YarnGPT TTS failed: ${response.statusCode}');
        debugPrint('   Response body: ${response.body}');
        return null;
      }
    } catch (e) {
      debugPrint('❌ YarnGPT TTS error: $e');
      debugPrint('   Stack trace: ${StackTrace.current}');
      return null;
    }
  }
  
  /// Test the TTS service with a sample text
  Future<bool> test() async {
    debugPrint('🧪 Testing YarnGPT TTS service...');
    final result = await textToSpeech(
      text: 'Hello, this is a test of YarnGPT text to speech.',
    );
    return result != null;
  }
}
