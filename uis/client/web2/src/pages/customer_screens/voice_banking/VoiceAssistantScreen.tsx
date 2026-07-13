import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { VoiceBankingService } from "../../../services/voice_banking_service";
import {
  VoiceCommandParser,
  VoiceCommandType,
  type VoiceCommand,
} from "../../../services/voice_command_parser";
import "./VoiceAssistantScreen.css";

interface ConversationMessage {
  isUser: boolean;
  text: string;
}

const VoiceAssistantScreen: React.FC = () => {
  const navigate = useNavigate();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastWords, setLastWords] = useState("");
  const [confidenceLevel, setConfidenceLevel] = useState(0);
  const [currentCommand, setCurrentCommand] = useState<VoiceCommand | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    ConversationMessage[]
  >([]);
  const [selectedLocale, setSelectedLocale] = useState("en-NG");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const voiceServiceRef = useRef<VoiceBankingService | null>(null);
  const lastProcessedCommandRef = useRef<VoiceCommand | null>(null);

  const availableLocales = ["en-NG", "yo-NG", "ig-NG", "ha-NG"];

  // Initialize voice banking
  useEffect(() => {
    const initializeVoiceBanking = async () => {
      try {
        console.log("🎤 Initializing voice banking");

        const service = new VoiceBankingService();
        voiceServiceRef.current = service;

        // Setup event handlers
        service.setOnListeningChange(setIsListening);
        service.setOnSpeakingChange(setIsSpeaking);
        service.setOnResultChange((result) => {
          setLastWords(result.words);
          setConfidenceLevel(result.confidence);

          if (result.isFinal && result.words) {
            // Parse command when final result is received
            const command = VoiceCommandParser.parseCommand(
              result.words,
              result.confidence,
              selectedLocale,
            );
            setCurrentCommand(command);

            // Add to conversation history
            setConversationHistory((prev) => [
              ...prev,
              { isUser: true, text: result.words },
            ]);
          }
        });
        service.setOnError((error) => {
          setErrorMessage(error);
          console.error("Voice banking error:", error);
        });

        const success = await service.initialize();
        setIsInitialized(success);

        if (success) {
          await service.speak(
            "Voice banking activated. How can I help you today?",
          );
        } else {
          setErrorMessage("Failed to initialize voice banking");
        }
      } catch (error) {
        console.error("Error initializing voice banking:", error);
        setErrorMessage(`Error: ${error}`);
        setIsInitialized(false);
      }
    };

    initializeVoiceBanking();

    return () => {
      // Cleanup
      if (voiceServiceRef.current) {
        voiceServiceRef.current.cleanup();
      }
    };
  }, []);

  // Handle language change
  const handleLocaleChange = async (newLocale: string) => {
    if (voiceServiceRef.current && newLocale !== selectedLocale) {
      await voiceServiceRef.current.setLocale(newLocale);
      setSelectedLocale(newLocale);

      // Announce language change
      const announcements: Record<string, string> = {
        "yo-NG": "Ede ti yipada si Yoruba",
        "ig-NG": "Asụsụ agbanweela na Igbo",
        "ha-NG": "An canza yare zuwa Hausa",
        "en-NG": "Language changed to English",
      };

      const announcement = announcements[newLocale] || announcements["en-NG"];
      await voiceServiceRef.current.speak(announcement);
    }
  };

  // Handle voice command
  const handleVoiceCommand = useCallback(
    async (command: VoiceCommand) => {
      if (!command || isProcessing) return;

      setIsProcessing(true);

      try {
        // Generate response based on command type
        let response = "";
        let navigateTo: string | null = null;

        switch (command.type) {
          case VoiceCommandType.CHECK_BALANCE:
            response = getLocalizedResponse("balance", selectedLocale);
            // Navigate to accounts or show balance
            break;

          case VoiceCommandType.TRANSFER:
            response = getLocalizedResponse("transfer", selectedLocale);
            navigateTo = "/transfer";
            break;

          case VoiceCommandType.PAY_BILL:
            response = getLocalizedResponse("bill", selectedLocale);
            navigateTo = "/bills";
            break;

          case VoiceCommandType.VIEW_TRANSACTIONS:
            response = getLocalizedResponse("transactions", selectedLocale);
            navigateTo = "/transaction-history";
            break;

          case VoiceCommandType.APPLY_LOAN:
            response = getLocalizedResponse("loan", selectedLocale);
            navigateTo = "/loan-application";
            break;

          case VoiceCommandType.OPEN_SAVINGS:
            response = getLocalizedResponse("savings", selectedLocale);
            navigateTo = "/savings";
            break;

          case VoiceCommandType.VIEW_LPOS:
            response = getLocalizedResponse("lpos", selectedLocale);
            navigateTo = "/active-lpos";
            break;

          case VoiceCommandType.VIEW_AGRICULTURE:
            response = getLocalizedResponse("agriculture", selectedLocale);
            navigateTo = "/agriculture";
            break;

          case VoiceCommandType.VIEW_INSURANCE:
            response = getLocalizedResponse("insurance", selectedLocale);
            navigateTo = "/insurance";
            break;

          case VoiceCommandType.VIEW_BANK_STATEMENT:
            response = getLocalizedResponse("bank_statement", selectedLocale);
            navigateTo = "/bank-statement";
            break;

          case VoiceCommandType.VIEW_CARBON_CREDITS:
            response = getLocalizedResponse("carbon_credits", selectedLocale);
            navigateTo = "/carbon-credits";
            break;

          case VoiceCommandType.VIEW_CARDS:
            response = getLocalizedResponse("cards", selectedLocale);
            navigateTo = "/cards";
            break;

          case VoiceCommandType.VIEW_ESCROW:
            response = getLocalizedResponse("escrow", selectedLocale);
            navigateTo = "/escrow";
            break;

          case VoiceCommandType.VIEW_MORTGAGE:
            response = getLocalizedResponse("mortgage", selectedLocale);
            navigateTo = "/mortgage";
            break;

          case VoiceCommandType.VIEW_EDUCATION:
            response = getLocalizedResponse("education", selectedLocale);
            navigateTo = "/education-loans";
            break;

          case VoiceCommandType.VIEW_ESUSU:
            response = getLocalizedResponse("esusu", selectedLocale);
            navigateTo = "/esusu";
            break;

          case VoiceCommandType.VIEW_VIRTUAL_ACCOUNTS:
            response = getLocalizedResponse("virtual_accounts", selectedLocale);
            navigateTo = "/van";
            break;

          case VoiceCommandType.HELP:
            showHelpDialog();
            break;

          case VoiceCommandType.UNKNOWN:
            response = getLocalizedResponse("unknown", selectedLocale);
            break;
        }

        if (response && voiceServiceRef.current) {
          await voiceServiceRef.current.speak(response);

          // Add assistant response to conversation
          setConversationHistory((prev) => [
            ...prev,
            { isUser: false, text: response },
          ]);
        }

        // Navigate if needed
        if (navigateTo) {
          setTimeout(() => {
            navigate(navigateTo);
          }, 1500); // Small delay for response to be spoken
        }

        // Clear the current command
        setCurrentCommand(null);
      } catch (error) {
        console.error("Error handling voice command:", error);
        setErrorMessage(`Error processing command: ${error}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, selectedLocale, navigate],
  );

  // Start listening
  const startListening = async () => {
    if (voiceServiceRef.current && !isListening) {
      setLastWords("");
      setConfidenceLevel(0);
      await voiceServiceRef.current.startListening();
    }
  };

  // Stop listening
  const stopListening = async () => {
    if (voiceServiceRef.current && isListening) {
      await voiceServiceRef.current.stopListening();

      // Wait a bit for final result
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  };

  // Show help dialog
  const showHelpDialog = () => {
    const helpText = VoiceCommandParser.getResponseText(VoiceCommandType.HELP, selectedLocale);
    alert(getLocalizedTitle(selectedLocale) + "\n\n" + helpText);
  };

  // Clear conversation history
  const clearHistory = () => {
    setConversationHistory([]);
  };

  // Auto-execute command when it changes
  useEffect(() => {
    if (
      currentCommand &&
      currentCommand !== lastProcessedCommandRef.current &&
      !isProcessing
    ) {
      lastProcessedCommandRef.current = currentCommand;
      handleVoiceCommand(currentCommand);
    }
  }, [currentCommand, isProcessing, handleVoiceCommand]);

  // Render loading state
  if (!isInitialized) {
    return (
      <div className="voice-assistant-screen loading">
        <div className="loading-content">
          <div className="mic-icon-container pulsing">
            <i className="fas fa-microphone"></i>
          </div>
          <div className="spinner"></div>
          <h3>Initializing Voice Banking...</h3>
          <p>Please wait while we set up your voice assistant</p>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-assistant-screen">
      <header className="voice-header">
        <div className="header-content">
          <button className="back-button" onClick={() => navigate(-1)}>
            <i className="fas fa-arrow-left"></i>
          </button>
          <div className="header-title">
            <div className="icon-wrapper">
              <i className="fas fa-microphone"></i>
            </div>
            <h1>Voice Banking</h1>
          </div>
          <button className="help-button" onClick={showHelpDialog}>
            <i className="fas fa-question-circle"></i>
          </button>
        </div>
      </header>

      <div className="voice-content">
        {/* Language Selector */}
        <div className="language-selector">
          <div className="selector-icon">
            <i className="fas fa-language"></i>
          </div>
          <select
            value={selectedLocale}
            onChange={(e) => handleLocaleChange(e.target.value)}
            className="locale-select"
          >
            {availableLocales.map((locale) => (
              <option key={locale} value={locale}>
                {getLocaleDisplayName(locale)}
              </option>
            ))}
          </select>
        </div>

        {/* Voice Visualizer */}
        <div className="voice-visualizer">
          <div
            className={`microphone-container ${isListening ? "listening" : ""}`}
          >
            <div className="microphone-glow"></div>
            <div className="microphone-icon">
              <i
                className={`fas ${isListening ? "fa-microphone" : "fa-microphone-slash"}`}
              ></i>
            </div>
          </div>

          <div className="status-text">
            <h2>
              {isListening
                ? getLocalizedListeningText(selectedLocale)
                : getLocalizedTapText(selectedLocale)}
            </h2>
          </div>

          {/* Recognized Text */}
          {lastWords && (
            <div className="recognized-text">
              <div className="text-header">
                <i className="fas fa-quote-left"></i>
                <span>You said:</span>
              </div>
              <p className="text-content">{lastWords}</p>

              {/* Confidence Indicator */}
              {confidenceLevel > 0 && (
                <div className="confidence-indicator">
                  <i
                    className={`fas fa-check-circle ${getConfidenceClass(confidenceLevel)}`}
                  ></i>
                  <span>Confidence: {(confidenceLevel * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Conversation History */}
        {conversationHistory.length > 0 && (
          <div className="conversation-history">
            <div className="history-header">
              <div className="header-left">
                <i className="fas fa-comments"></i>
                <h3>{getLocalizedConversation(selectedLocale)}</h3>
              </div>
              <button className="clear-button" onClick={clearHistory}>
                <i className="fas fa-trash-alt"></i>
                {getLocalizedClear(selectedLocale)}
              </button>
            </div>
            <div className="history-messages">
              {conversationHistory.map((message, index) => (
                <div
                  key={index}
                  className={`message ${message.isUser ? "user" : "assistant"}`}
                >
                  <p>{message.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="control-buttons">
        <button
          className={`control-btn ${isListening ? "stop-btn" : "speak-btn"}`}
          onClick={isListening ? stopListening : startListening}
          disabled={isSpeaking}
        >
          <i className={`fas ${isListening ? "fa-stop" : "fa-microphone"}`}></i>
          <span>
            {isListening
              ? getLocalizedStopButton(selectedLocale)
              : getLocalizedSpeakButton(selectedLocale)}
          </span>
        </button>

        {currentCommand && !isListening && (
          <button
            className="control-btn execute-btn"
            onClick={() => handleVoiceCommand(currentCommand)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <div className="spinner-small"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <i className="fas fa-check-circle"></i>
                <span>{getLocalizedExecuteButton(selectedLocale)}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}
    </div>
  );
};

// Helper functions for localization
function getLocaleDisplayName(locale: string): string {
  const names: Record<string, string> = {
    "en-NG": "🇳🇬 English",
    "yo-NG": "🇳🇬 Yoruba",
    "ig-NG": "🇳🇬 Igbo",
    "ha-NG": "🇳🇬 Hausa",
  };
  return names[locale] || locale;
}

function getLocalizedTitle(locale: string): string {
  const titles: Record<string, string> = {
    "yo-NG": "Awọn Aṣẹ Ohùn",
    "ig-NG": "Iwu Olu",
    "ha-NG": "Umarnin Murya",
    "en-NG": "Voice Commands",
  };
  return titles[locale] || titles["en-NG"];
}

function getLocalizedListeningText(locale: string): string {
  const texts: Record<string, string> = {
    "yo-NG": "N gbọ...",
    "ig-NG": "Ana m ege ntị...",
    "ha-NG": "Ina saurare...",
    "en-NG": "Listening...",
  };
  return texts[locale] || texts["en-NG"];
}

function getLocalizedTapText(locale: string): string {
  const texts: Record<string, string> = {
    "yo-NG": "Tẹ igboohun lati sọrọ",
    "ig-NG": "Pịa igwe okwu ka ị kwuo okwu",
    "ha-NG": "Danna makirufo don yin magana",
    "en-NG": "Tap the microphone to speak",
  };
  return texts[locale] || texts["en-NG"];
}

function getLocalizedSpeakButton(locale: string): string {
  const texts: Record<string, string> = {
    "yo-NG": "Sọrọ",
    "ig-NG": "Kwuo",
    "ha-NG": "Yi magana",
    "en-NG": "Speak",
  };
  return texts[locale] || texts["en-NG"];
}

function getLocalizedStopButton(locale: string): string {
  const texts: Record<string, string> = {
    "yo-NG": "Duro",
    "ig-NG": "Kwụsị",
    "ha-NG": "Tsaya",
    "en-NG": "Stop",
  };
  return texts[locale] || texts["en-NG"];
}

function getLocalizedExecuteButton(locale: string): string {
  const texts: Record<string, string> = {
    "yo-NG": "Ṣe",
    "ig-NG": "Mee",
    "ha-NG": "Aiwatar",
    "en-NG": "Execute",
  };
  return texts[locale] || texts["en-NG"];
}

function getLocalizedConversation(locale: string): string {
  const texts: Record<string, string> = {
    "yo-NG": "Ibaraẹnisọrọ",
    "ig-NG": "Mkparịta ụka",
    "ha-NG": "Tattaunawa",
    "en-NG": "Conversation",
  };
  return texts[locale] || texts["en-NG"];
}

function getLocalizedClear(locale: string): string {
  const texts: Record<string, string> = {
    "yo-NG": "Paarẹ",
    "ig-NG": "Hichapụ",
    "ha-NG": "Share",
    "en-NG": "Clear",
  };
  return texts[locale] || texts["en-NG"];
}

function getLocalizedResponse(key: string, locale: string): string {
  const responses: Record<string, Record<string, string>> = {
    balance: {
      "en-NG": "Opening your account balance",
      "yo-NG": "Mo n ṣí iwontunwonsi rẹ",
      "ig-NG": "Ana m emepe nguzozi gị",
      "ha-NG": "Ina buɗe ragowar ku din ku",
    },
    transfer: {
      "en-NG": "Opening transfer screen",
      "yo-NG": "Mo n ṣí iboju gbigbe owo",
      "ig-NG": "Ana m emepe ihuenyo mbufe",
      "ha-NG": "Ina buɗe allon tura",
    },
    bill: {
      "en-NG": "Opening bill payment",
      "yo-NG": "Mo n ṣí isanwo owo",
      "ig-NG": "Ana m emepe ịkwụ ụgwọ",
      "ha-NG": "Ina buɗe biyan kuɗi",
    },
    transactions: {
      "en-NG": "Showing your transactions",
      "yo-NG": "Mo n fi awọn iṣowo rẹ han",
      "ig-NG": "Ana m egosi azụmahịa gị",
      "ha-NG": "Ina nuna ma'amalolinku",
    },
    loan: {
      "en-NG": "Opening loan application",
      "yo-NG": "Mo n ṣí ìbéèrè awin",
      "ig-NG": "Ana m emepe arịrịọ mgbazinye",
      "ha-NG": "Ina buɗe neman bashi",
    },
    savings: {
      "en-NG": "Opening savings",
      "yo-NG": "Mo n ṣí fipamọ",
      "ig-NG": "Ana m emepe nchekwa",
      "ha-NG": "Ina buɗe ajiya",
    },
    lpos: {
      "en-NG": "Opening LPO screen",
      "yo-NG": "Mo n ṣí iboju LPO",
      "ig-NG": "Ana m emepe ihuenyo LPO",
      "ha-NG": "Ina buɗe allon LPO",
    },
    agriculture: {
      "en-NG": "Opening agriculture banking",
      "yo-NG": "Mo n ṣí ìfowópamọ́ ọgbìn",
      "ig-NG": "Ana m emepe ụlọ akụ ọrụ ugbo",
      "ha-NG": "Ina buɗe bankin noma",
    },
    insurance: {
      "en-NG": "Opening insurance",
      "yo-NG": "Mo n ṣí ìṣèdúró",
      "ig-NG": "Ana m emepe mkpuchi",
      "ha-NG": "Ina buɗe inshora",
    },
    bank_statement: {
      "en-NG": "Opening bank statement",
      "yo-NG": "Mo n ṣí àlàyé bánkì",
      "ig-NG": "Ana m emepe nkọwa ụlọ akụ",
      "ha-NG": "Ina buɗe bayanan banki",
    },
    carbon_credits: {
      "en-NG": "Opening carbon credits",
      "yo-NG": "Mo n ṣí kírẹ́dìtì erogba",
      "ig-NG": "Ana m emepe kredit carbon",
      "ha-NG": "Ina buɗe carbon credits",
    },
    cards: {
      "en-NG": "Opening your cards",
      "yo-NG": "Mo n ṣí àwọn káàdì rẹ",
      "ig-NG": "Ana m emepe kaadị gị",
      "ha-NG": "Ina buɗe katunanku",
    },
    escrow: {
      "en-NG": "Opening escrow",
      "yo-NG": "Mo n ṣí escrow",
      "ig-NG": "Ana m emepe escrow",
      "ha-NG": "Ina buɗe escrow",
    },
    mortgage: {
      "en-NG": "Opening mortgage",
      "yo-NG": "Mo n ṣí àwìn ilé",
      "ig-NG": "Ana m emepe mgbazinye ụlọ",
      "ha-NG": "Ina buɗe lamunin gida",
    },
    education: {
      "en-NG": "Opening education banking",
      "yo-NG": "Mo n ṣí bánkì ẹ̀kọ́",
      "ig-NG": "Ana m emepe ụlọ akụ agụmakwụkwọ",
      "ha-NG": "Ina buɗe bankin ilimi",
    },
    esusu: {
      "en-NG": "Opening esusu",
      "yo-NG": "Mo n ṣí esusu",
      "ig-NG": "Ana m emepe esusu",
      "ha-NG": "Ina buɗe esusu",
    },
    virtual_accounts: {
      "en-NG": "Opening virtual accounts",
      "yo-NG": "Mo n ṣí àkáùntù fojú",
      "ig-NG": "Ana m emepe akaụntụ nke mbara",
      "ha-NG": "Ina buɗe asusun kama-da-wane",
    },
    unknown: {
      "en-NG": "Sorry, I did not understand that command",
      "yo-NG": "Má bínú, mi ò gbọ̀ àṣẹ yẹn",
      "ig-NG": "Ndo, aghọtaghị m iwu ahụ",
      "ha-NG": "Yi hakuri, ban fahimci wannan umarni ba",
    },
  };

  return responses[key]?.[locale] || responses[key]?.["en-NG"] || "";
}

function getConfidenceClass(confidence: number): string {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

export default VoiceAssistantScreen;
