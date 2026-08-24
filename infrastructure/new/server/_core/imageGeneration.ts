/**
 * Image generation helper for 54Bank platform.
 * Uses the standard OpenAI Images API (DALL-E 3 / DALL-E 2).
 * Compatible with any OpenAI-compatible image generation provider.
 *
 * Configuration:
 *   OLLAMA_API_BASE  — Ollama server URL (default: http://ollama:11434)
 *   OLLAMA_API_KEY   — optional API key (not required for standard Ollama)
 *   IMAGE_GEN_MODEL  — optional (default: llava for Ollama)
 */
import { ENV } from "./env";

export type GenerateImageParams = {
  prompt: string;
  model?: string;
  size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  n?: number;
  style?: "vivid" | "natural";
};

export type GenerateImageResult = {
  url: string;
  revised_prompt?: string;
};

export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  // Ollama does not require an API key — no assertion needed
  // (key is optional for Ollama)

  const base = (ENV.ollamaApiBase ?? "http://ollama:11434").replace(/\/$/, "");
  const response = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(ENV.ollamaApiKey ? { authorization: `Bearer ${ENV.ollamaApiKey}` } : {}),
    },
    body: JSON.stringify({
      model: params.model ?? process.env.IMAGE_GEN_MODEL ?? "llava",
      prompt: params.prompt,
      size: params.size ?? "1024x1024",
      quality: params.quality ?? "standard",
      n: params.n ?? 1,
      ...(params.style ? { style: params.style } : {}),
      response_format: "url",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image generation failed: ${response.status} ${response.statusText} — ${errorText}`);
  }

  const data = await response.json() as { data: Array<{ url: string; revised_prompt?: string }> };
  const first = data.data?.[0];
  if (!first?.url) throw new Error("Image generation returned no URL");
  return { url: first.url, revised_prompt: first.revised_prompt };
}
