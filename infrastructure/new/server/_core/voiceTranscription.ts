/**
 * Voice transcription helper for 54Bank platform.
 * Uses the standard OpenAI Audio Transcriptions API (Whisper).
 * Compatible with any OpenAI-compatible transcription provider.
 *
 * Configuration:
 *   OLLAMA_API_BASE     — Ollama server URL (default: http://ollama:11434)
 *   OLLAMA_API_KEY      — optional API key (not required for standard Ollama)
 *   WHISPER_MODEL       — optional (default: whisper for Ollama)
 */
import { ENV } from "./env";

export type TranscribeParams = {
  audioUrl: string;
  language?: string;
  prompt?: string;
};

export type TranscribeResult = {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{ start: number; end: number; text: string }>;
};

export async function transcribeAudio(params: TranscribeParams): Promise<TranscribeResult> {
  // Ollama does not require an API key
  // (key is optional for Ollama)

  // Download the audio file from the URL
  const audioResponse = await fetch(params.audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio from ${params.audioUrl}: ${audioResponse.status}`);
  }
  const audioBuffer = await audioResponse.arrayBuffer();
  const audioBlob = new Blob([audioBuffer]);

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", process.env.WHISPER_MODEL ?? "whisper");
  formData.append("response_format", "verbose_json");
  if (params.language) formData.append("language", params.language);
  if (params.prompt) formData.append("prompt", params.prompt);

  const base = (ENV.ollamaApiBase ?? "http://ollama:11434").replace(/\/$/, "");
  const response = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { ...(ENV.ollamaApiKey ? { authorization: `Bearer ${ENV.ollamaApiKey}` } : {}) },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Transcription failed: ${response.status} ${response.statusText} — ${errorText}`);
  }

  const data = await response.json() as {
    text: string;
    language?: string;
    duration?: number;
    segments?: Array<{ start: number; end: number; text: string }>;
  };

  return {
    text: data.text,
    language: data.language,
    duration: data.duration,
    segments: data.segments,
  };
}
