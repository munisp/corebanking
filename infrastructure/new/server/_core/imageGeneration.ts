/**
 * Image generation helper for 54Bank platform.
 * Uses the standard OpenAI Images API (DALL-E 3 / DALL-E 2).
 * Compatible with any OpenAI-compatible image generation provider.
 *
 * Configuration:
 *   OPENAI_API_KEY   — required
 *   OPENAI_API_BASE  — optional (default: https://api.openai.com/v1)
 *   IMAGE_GEN_MODEL  — optional (default: dall-e-3)
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
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured for image generation.");
  }

  const base = (ENV.openaiApiBase ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: params.model ?? process.env.IMAGE_GEN_MODEL ?? "dall-e-3",
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
