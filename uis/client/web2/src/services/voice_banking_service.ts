/**
 * Voice Banking Service for Web
 * 
 * This service provides voice command and text-to-speech capabilities for the web app
 * using the Web Speech API (equivalent to mobile's speech-to-text and TTS)
 */

export class VoiceBankingService {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis;
  private isListening: boolean = false;
  private isInitialized: boolean = false;
  private isSpeaking: boolean = false;
  private lastWords: string = '';
  private lastCommand: string = '';
  private confidenceLevel: number = 0;
  private selectedLocale: string = 'en-NG';
  
  // Static available locales for Nigeria
  private static readonly STATIC_LOCALES = [
    'en-NG', // English (Nigeria)
    'en-US', // English (US) - fallback
    'yo-NG', // Yoruba
    'ig-NG', // Igbo
    'ha-NG', // Hausa
  ];

  private availableLocales: string[] = [...VoiceBankingService.STATIC_LOCALES];

  // Event handlers
  private onListeningChange?: (isListening: boolean) => void;
  private onSpeakingChange?: (isSpeaking: boolean) => void;
  private onResultChange?: (result: { words: string; confidence: number; isFinal: boolean }) => void;
  private onError?: (error: string) => void;

  constructor() {
    this.synthesis = window.speechSynthesis;
    
    // Check if Web Speech API is supported
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionAPI();
      this.setupRecognition();
    } else {
      console.warn('Speech recognition not supported in this browser');
    }
  }

  /**
   * Setup speech recognition
   */
  private setupRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.selectedLocale;

    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('Started listening');
      this.onListeningChange?.( this.isListening);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('Stopped listening');
      this.onListeningChange?.(this.isListening);
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      
      if (lastResult) {
        const transcript = lastResult[0].transcript;
        const confidence = lastResult[0].confidence;
        const isFinal = lastResult.isFinal;

        this.lastWords = transcript;
        this.confidenceLevel = confidence;

        if (isFinal) {
          this.lastCommand = transcript;
          console.log(`Final result: ${this.lastCommand} (confidence: ${confidence})`);
        } else {
          console.log(`Partial result: ${this.lastWords}`);
        }

        this.onResultChange?.({ words: transcript, confidence, isFinal });
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
      this.onListeningChange?.(this.isListening);
      this.onError?.(event.error);
    };
  }

  /**
   * Initialize voice banking service
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Check if speech recognition is available
      if (!this.recognition) {
        console.error('Speech recognition not supported');
        return false;
      }

      // Check if microphone permission is granted (modern browsers)
      if (navigator.permissions) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (permissionStatus.state === 'denied') {
            console.error('Microphone permission denied');
            return false;
          }
        } catch (e) {
          // Permissions API might not be fully supported, continue anyway
          console.warn('Unable to check microphone permission:', e);
        }
      }

      // Get available voices for TTS
      const voices = this.synthesis.getVoices();
      console.log(`Voice banking initialized with ${voices.length} voices`);
      console.log('Available locales:', this.availableLocales);

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize voice banking:', error);
      return false;
    }
  }

  /**
   * Start listening to voice commands
   */
  async startListening(): Promise<void> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize voice banking');
      }
    }

    if (this.isListening || !this.recognition) return;

    try {
      this.lastWords = '';
      this.confidenceLevel = 0;
      
      // Update recognition language
      this.recognition.lang = this.selectedLocale;
      
      console.log(`Starting to listen with locale: ${this.selectedLocale}`);
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start listening:', error);
      this.isListening = false;
      this.onListeningChange?.(this.isListening);
      throw error;
    }
  }

  /**
   * Stop listening
   */
  async stopListening(): Promise<void> {
    if (!this.isListening || !this.recognition) return;

    try {
      this.recognition.stop();
      console.log('Stopped listening');
    } catch (error) {
      console.error('Failed to stop listening:', error);
      throw error;
    }
  }

  /**
   * Speak a response using text-to-speech
   */
  async speak(text: string): Promise<void> {
    try {
      // Stop any ongoing speech
      if (this.isSpeaking) {
        this.synthesis.cancel();
      }

      console.log(`Speaking: ${text} (locale: ${this.selectedLocale})`);

      const utterance = new SpeechSynthesisUtterance(text);

      // Set language
      utterance.lang = this.selectedLocale;
      utterance.rate = 0.9; // Slightly slower for better comprehension
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Try to find a voice that matches the selected locale
      const voices = this.synthesis.getVoices();
      const matchingVoice = voices.find(voice => 
        voice.lang.startsWith(this.selectedLocale.split('-')[0])
      );
      
      if (matchingVoice) {
        utterance.voice = matchingVoice;
        console.log(`Using voice: ${matchingVoice.name}`);
      } else {
        console.log('No matching voice found, using default');
      }

      // Event handlers
      utterance.onstart = () => {
        this.isSpeaking = true;
        this.onSpeakingChange?.(this.isSpeaking);
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.onSpeakingChange?.(this.isSpeaking);
      };

      utterance.onerror = (event) => {
        console.error('TTS error:', event);
        this.isSpeaking = false;
        this.onSpeakingChange?.(this.isSpeaking);
        this.onError?.(event.error);
      };

      this.synthesis.speak(utterance);
    } catch (error) {
      console.error('Failed to speak:', error);
      throw error;
    }
  }

  /**
   * Stop speaking
   */
  async stopSpeaking(): Promise<void> {
    try {
      this.synthesis.cancel();
      this.isSpeaking = false;
      this.onSpeakingChange?.(this.isSpeaking);
    } catch (error) {
      console.error('Failed to stop speaking:', error);
      throw error;
    }
  }

  /**
   * Change locale
   */
  async setLocale(locale: string): Promise<void> {
    if (!this.availableLocales.includes(locale)) {
      console.warn(`Locale ${locale} not available`);
      return;
    }

    this.selectedLocale = locale;
    
    if (this.recognition) {
      this.recognition.lang = locale;
    }

    console.log(`Locale changed to: ${locale}`);
  }

  /**
   * Get available locales
   */
  getAvailableLocales(): string[] {
    return [...this.availableLocales];
  }

  /**
   * Get available voices for TTS
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.synthesis.getVoices();
  }

  /**
   * Clear last command
   */
  clearCommand(): void {
    this.lastCommand = '';
    this.lastWords = '';
    this.confidenceLevel = 0;
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: {
    onListeningChange?: (isListening: boolean) => void;
    onSpeakingChange?: (isSpeaking: boolean) => void;
    onResultChange?: (result: { words: string; confidence: number; isFinal: boolean }) => void;
    onError?: (error: string) => void;
  }): void {
    this.onListeningChange = handlers.onListeningChange;
    this.onSpeakingChange = handlers.onSpeakingChange;
    this.onResultChange = handlers.onResultChange;
    this.onError = handlers.onError;
  }

  /**
   * Individual setter methods for event handlers
   */
  setOnListeningChange(handler: (isListening: boolean) => void): void {
    this.onListeningChange = handler;
  }

  setOnSpeakingChange(handler: (isSpeaking: boolean) => void): void {
    this.onSpeakingChange = handler;
  }

  setOnResultChange(handler: (result: { words: string; confidence: number; isFinal: boolean }) => void): void {
    this.onResultChange = handler;
  }

  setOnError(handler: (error: string) => void): void {
    this.onError = handler;
  }

  /**
   * Getters
   */
  get listening(): boolean {
    return this.isListening;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }

  get speaking(): boolean {
    return this.isSpeaking;
  }

  get words(): string {
    return this.lastWords;
  }

  get command(): string {
    return this.lastCommand;
  }

  get confidence(): number {
    return this.confidenceLevel;
  }

  get locale(): string {
    return this.selectedLocale;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.recognition) {
      this.recognition.abort();
    }
    this.synthesis.cancel();
  }

  /**
   * Cleanup (alias for dispose)
   */
  cleanup(): void {
    this.dispose();
  }
}

// Create singleton instance
export const voiceBankingService = new VoiceBankingService();

// Type definitions for Web Speech API
declare global {
  interface SpeechRecognitionConstructor {
    new (): SpeechRecognition;
  }

  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  
  start(): void;
  stop(): void;
  abort(): void;
  
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}
