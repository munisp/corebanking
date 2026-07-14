/**
 * LLM integration helper for 54Bank platform.
 * Uses the standard OpenAI-compatible Chat Completions API.
 * Compatible with: OpenAI, Azure OpenAI, Ollama, vLLM, LM Studio, Groq, Anthropic (via proxy), etc.
 *
 * Configuration (environment variables):
 *   OPENAI_API_KEY   — required: your API key
 *   OPENAI_API_BASE  — optional: override base URL (default: https://api.openai.com/v1)
 *   LLM_MODEL        — optional: override default model (default: gpt-4o-mini)
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";

const resolveApiUrl = (): string => {
  const base = (ENV.openaiApiBase ?? "https://api.openai.com/v1").replace(/\/$/, "");
  return `${base}/chat/completions`;
};

const assertApiKey = (): void => {
  if (!ENV.openaiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Set the OPENAI_API_KEY environment variable."
    );
  }
};

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
  if (explicit) {
    if (explicit.type === "json_schema" && !(explicit as any).json_schema?.schema) {
      throw new Error("responseFormat json_schema requires a defined schema object");
    }
    return explicit;
  }
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
 * Invoke the configured LLM via the standard OpenAI Chat Completions API.
 * Works with any OpenAI-compatible provider.
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages, tools, toolChoice, tool_choice,
    outputSchema, output_schema, responseFormat, response_format,
    model, maxTokens, max_tokens, temperature,
  } = params;

  const payload: Record<string, unknown> = {
    model: model ?? DEFAULT_MODEL,
    messages: messages.map(normalizeMessage),
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
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} — ${errorText}`);
  }

  return (await response.json()) as InvokeResult;
}

/**
 * List available models from the configured OpenAI-compatible provider.
 */
export async function listLLMModels(): Promise<{ id: string; object: string; created: number; owned_by: string }[]> {
  assertApiKey();
  const base = (ENV.openaiApiBase ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${base}/models`, {
    headers: { authorization: `Bearer ${ENV.openaiApiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
  }
  const data = await response.json() as { data: any[] };
  return data.data ?? [];
}
