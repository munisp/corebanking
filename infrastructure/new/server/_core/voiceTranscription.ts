/**
 * Voice transcription helper for 54Bank platform.
 * Uses the standard OpenAI Audio Transcriptions API (Whisper).
 * Compatible with any OpenAI-compatible transcription provider.
 *
 * Configuration:
 *   OPENAI_API_KEY      — required
 *   OPENAI_API_BASE     — optional (default: https://api.openai.com/v1)
 *   WHISPER_MODEL       — optional (default: whisper-1)
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
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured for voice transcription.");
  }

  // Download the audio file from the URL
  const audioResponse = await fetch(params.audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio from ${params.audioUrl}: ${audioResponse.status}`);
  }
  const audioBuffer = await audioResponse.arrayBuffer();
  const audioBlob = new Blob([audioBuffer]);

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", process.env.WHISPER_MODEL ?? "whisper-1");
  formData.append("response_format", "verbose_json");
  if (params.language) formData.append("language", params.language);
  if (params.prompt) formData.append("prompt", params.prompt);

  const base = (ENV.openaiApiBase ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${ENV.openaiApiKey}` },
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
