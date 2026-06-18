/**
 * Voice Banking Configuration
 *
 * This file controls whether to use mock data or real voice banking services.
 *
 * Set `useMockVoiceBanking` to:
 * - true: Use mock data (for testing, development, or when hardware is unavailable)
 * - false: Use real voice banking with actual speech recognition and TTS
 */

export class VoiceBankingConfig {
  /**
   * Toggle between mock and real voice banking
   *
   * true = Mock voice banking (simulated, no hardware required)
   * false = Real voice banking (requires microphone and permissions)
   */
  static readonly useMockVoiceBanking = false;

  /**
   * Enable verbose logging for voice banking operations
   */
  static readonly enableLogging = false;

  /**
   * Mock command cycle delay (milliseconds)
   * Controls how long the mock service waits before recognizing a command
   */
  static readonly mockCommandDelay = 500;

  /**
   * Mock TTS duration multiplier
   * Controls how long mock TTS takes (text length * multiplier)
   */
  static readonly mockTtsDurationPerChar = 30;
}
