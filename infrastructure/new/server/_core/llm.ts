/**
 * LLM integration helper for 54Bank platform.
 * Default backend: Ollama (local, open-source, no API key required).
 *
 * Ollama exposes an OpenAI-compatible API at /api/chat and /v1/chat/completions.
 * This module uses the /v1/chat/completions endpoint for maximum compatibility.
 *
 * Configuration (environment variables):
 *   OLLAMA_API_BASE  — Ollama server URL (default: http://ollama:11434)
 *   OLLAMA_API_KEY   — API key (optional, only needed behind an auth proxy)
 *   LLM_MODEL        — Model to use (default: llama3.2)
 *
 * Supported Ollama models (pull with `ollama pull <model>`):
 *   llama3.2, llama3.1, mistral, gemma2, phi3, qwen2.5, deepseek-r1, etc.
 *
 * To switch to a different OpenAI-compatible provider, set:
 *   OLLAMA_API_BASE=https://api.openai.com/v1  OLLAMA_API_KEY=sk-...  LLM_MODEL=gpt-4o-mini
 *   OLLAMA_API_BASE=https://api.groq.com/openai/v1  OLLAMA_API_KEY=gsk_...  LLM_MODEL=llama-3.1-70b-versatile
 *
 * Example usage:
 *   const result = await invokeLLM({
 *     messages: [{ role: "user", content: "Summarise this transaction." }],
 *   });
 */
import { ENV } from "./env";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };
export type FileContent = { type: "file_url"; file_url: { url: string } };
export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: "system" | "user" | "assistant" | "tool" | "function";
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoice =
  | "none"
  | "auto"
  | "required"
  | { name: string }
  | { type: "function"; function: { name: string } };

export type OutputSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean } };

export type InvokeParams = {
  messages: Message[];
  model?: string;
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  maxTokens?: number;
  max_tokens?: number;
  temperature?: number;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type Choice = {
  index: number;
  message: {
    role: string;
    content: string | null;
    tool_calls?: ToolCall[];
  };
  finish_reason: string;
};

export type InvokeResult = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

// ─── Configuration ────────────────────────────────────────────────────────────

/** Default model — llama3.2 is a fast, capable general-purpose model available in Ollama */
const DEFAULT_MODEL = process.env.LLM_MODEL ?? "llama3.2";

const resolveApiUrl = (): string => {
  const base = (ENV.ollamaApiBase ?? "http://ollama:11434").replace(/\/$/, "");
  // Ollama supports the OpenAI-compatible endpoint at /v1/chat/completions
  return `${base}/v1/chat/completions`;
};

const buildHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  // Ollama does not require an API key — only add if explicitly configured
  if (ENV.ollamaApiKey) {
    headers["authorization"] = `Bearer ${ENV.ollamaApiKey}`;
  }
  return headers;
};

// ─── Normalizers ──────────────────────────────────────────────────────────────

const ensureArray = (value: MessageContent | MessageContent[]): MessageContent[] =>
  Array.isArray(value) ? value : [value];

const normalizeContentPart = (part: MessageContent): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") return { type: "text", text: part };
  if (part.type === "text" || part.type === "image_url" || part.type === "file_url") return part;
  throw new Error(`Unsupported message content part type: ${(part as any).type}`);
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(p => (typeof p === "string" ? p : JSON.stringify(p)))
      .join("\n");
    return { role, name, tool_call_id, content };
  }
  const parts = ensureArray(message.content).map(normalizeContentPart);
  if (parts.length === 1 && parts[0].type === "text") {
    return { role, name, content: parts[0].text };
  }
  return { role, name, content: parts };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | { type: "function"; function: { name: string } } | undefined => {
  if (!toolChoice) return undefined;
  if (toolChoice === "none" || toolChoice === "auto") return toolChoice;
  if (toolChoice === "required") {
    if (!tools?.length) throw new Error("tool_choice 'required' requires at least one tool");
    if (tools.length > 1) throw new Error("tool_choice 'required' requires exactly one tool or specify by name");
    return { type: "function", function: { name: tools[0].function.name } };
  }
  if ("name" in toolChoice) return { type: "function", function: { name: toolChoice.name } };
  return toolChoice as { type: "function"; function: { name: string } };
};

const normalizeResponseFormat = ({
  responseFormat, response_format, outputSchema, output_schema,
}: Pick<InvokeParams, "responseFormat" | "response_format" | "outputSchema" | "output_schema">):
  ResponseFormat | undefined => {
  const explicit = responseFormat ?? response_format;
  if (explicit) return explicit;
  const schema = outputSchema ?? output_schema;
  if (!schema) return undefined;
  if (!schema.name || !schema.schema) throw new Error("outputSchema requires both name and schema");
  return {
    type: "json_schema",
    json_schema: { name: schema.name, schema: schema.schema, ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}) },
  };
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Invoke Ollama (or any OpenAI-compatible LLM) via the /v1/chat/completions endpoint.
 *
 * Ollama must be running and the model must be pulled:
 *   docker run -d -p 11434:11434 ollama/ollama
 *   ollama pull llama3.2
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const {
    messages, tools, toolChoice, tool_choice,
    outputSchema, output_schema, responseFormat, response_format,
    model, maxTokens, max_tokens, temperature,
  } = params;

  const payload: Record<string, unknown> = {
    model: model ?? DEFAULT_MODEL,
    messages: messages.map(normalizeMessage),
    stream: false,
  };

  if (tools?.length) payload.tools = tools;

  const normalizedToolChoice = normalizeToolChoice(toolChoice ?? tool_choice, tools);
  if (normalizedToolChoice) payload.tool_choice = normalizedToolChoice;

  const tokens = maxTokens ?? max_tokens;
  if (tokens) payload.max_tokens = tokens;
  if (temperature !== undefined) payload.temperature = temperature;

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat, response_format, outputSchema, output_schema,
  });
  if (normalizedResponseFormat) payload.response_format = normalizedResponseFormat;

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Ollama LLM invoke failed [${response.status} ${response.statusText}]: ${errorText}\n` +
      `Ensure Ollama is running at ${ENV.ollamaApiBase} and model '${model ?? DEFAULT_MODEL}' is pulled.\n` +
      `Run: docker exec -it ollama ollama pull ${model ?? DEFAULT_MODEL}`
    );
  }

  return (await response.json()) as InvokeResult;
}

/**
 * List models available in the Ollama instance.
 * Equivalent to `ollama list`.
 */
export async function listLLMModels(): Promise<{ id: string; object: string; created: number; owned_by: string }[]> {
  const base = (ENV.ollamaApiBase ?? "http://ollama:11434").replace(/\/$/, "");
  // Ollama exposes /v1/models (OpenAI-compatible) and /api/tags (native)
  const response = await fetch(`${base}/v1/models`, {
    headers: buildHeaders(),
  });
  if (!response.ok) {
    // Fallback to Ollama native /api/tags endpoint
    const tagsResponse = await fetch(`${base}/api/tags`, { headers: buildHeaders() });
    if (!tagsResponse.ok) {
      throw new Error(`Failed to list Ollama models: ${response.status} ${response.statusText}`);
    }
    const tags = await tagsResponse.json() as { models: Array<{ name: string; modified_at: string }> };
    return (tags.models ?? []).map(m => ({
      id: m.name,
      object: "model",
      created: Math.floor(new Date(m.modified_at).getTime() / 1000),
      owned_by: "ollama",
    }));
  }
  const data = await response.json() as { data: any[] };
  return data.data ?? [];
}
