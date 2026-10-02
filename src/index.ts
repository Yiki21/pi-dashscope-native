import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type ImageContent,
  type JsonObject,
  type Message,
  type Model,
  type SimpleStreamOptions,
  type StopReason,
  type TextContent,
  type ThinkingContent,
  type Tool,
  type ToolCall,
  calculateCost,
  createAssistantMessageEventStream,
} from "@earendil-works/pi-ai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROVIDER_ID = "alibaba-qwen-dashscope-native";
const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
const CONFIG_DIR = path.join(os.homedir(), ".pi", "agent");
const WECHAT_CONFIG_PATH = path.join(os.homedir(), ".pi", "wechat", "config.json");
const USAGE_LOG_PATH = path.join(CONFIG_DIR, "extensions", "pi-dashscope-native", "usage.json");

type NativeApiKind = "text" | "multimodal";
type ModelInput = ("text" | "image")[];
type NativeContentPart = { text: string } | { image: string };

interface QwenModelConfig {
  id: string;
  name: string;
  nativeApi: NativeApiKind;
  baseUrl?: string;
  input: ModelInput;
  contextWindow: number;
  maxTokens: number;
  maxThinkingTokens: number;
  forcedThinking?: boolean;
}

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
const MILLION_TOKENS = 1_000_000;
const MAX_OUTPUT_TOKENS = 131_072;

export const QWEN_MODELS: QwenModelConfig[] = [
  {
    id: "qwen3.8-max",
    name: "Qwen 3.8 Max",
    nativeApi: "multimodal",
    input: ["text", "image"],
    contextWindow: MILLION_TOKENS,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxThinkingTokens: 262_144,
  },
  {
    id: "qwen3.8-flash",
    name: "Qwen 3.8 Flash",
    nativeApi: "multimodal",
    input: ["text", "image"],
    contextWindow: MILLION_TOKENS,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxThinkingTokens: 262_144,
  },
  {
    id: "qwen3.8-2.4t-a95b",
    name: "Qwen 3.8 2.4T A95B",
    nativeApi: "multimodal",
    input: ["text"],
    contextWindow: MILLION_TOKENS,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxThinkingTokens: 131_072,
  },
  {
    id: "qwen3.8-27b",
    name: "Qwen 3.8 27B",
    nativeApi: "multimodal",
    input: ["text", "image"],
    contextWindow: MILLION_TOKENS,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxThinkingTokens: 262_144,
  },
  {
    id: "qwen3.7-max",
    name: "Qwen 3.7 Max",
    nativeApi: "text",
    input: ["text"],
    contextWindow: MILLION_TOKENS,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxThinkingTokens: 262_144,
  },
  {
    id: "qwen3.7-max-us",
    name: "Qwen 3.7 Max US",
    nativeApi: "text",
    baseUrl: "https://dashscope-us.aliyuncs.com/api/v1",
    input: ["text"],
    contextWindow: MILLION_TOKENS,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxThinkingTokens: 262_144,
  },
  {
    id: "qwen3.7-max-2026-06-08",
    name: "Qwen 3.7 Max 2026-06-08",
    nativeApi: "multimodal",
    input: ["text", "image"],
    contextWindow: MILLION_TOKENS,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxThinkingTokens: 262_144,
  },
  {
    id: "qwen3.7-max-2026-05-20",
    name: "Qwen 3.7 Max 2026-05-20",
    nativeApi: "text",
    input: ["text"],
    contextWindow: MILLION_TOKENS,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxThinkingTokens: 262_144,
  },
  {
    id: "qwen3.7-max-preview",
    name: "Qwen 3.7 Max Preview",
    nativeApi: "text",
    input: ["text"],
    contextWindow: MILLION_TOKENS,
    maxTokens: 65_536,
    maxThinkingTokens: 262_144,
    forcedThinking: true,
  },
  {
    id: "qwen3.7-max-2026-05-17",
    name: "Qwen 3.7 Max 2026-05-17",
    nativeApi: "text",
    input: ["text"],
    contextWindow: MILLION_TOKENS,
    maxTokens: 65_536,
    maxThinkingTokens: 262_144,
    forcedThinking: true,
  },
  {
    id: "qwen3.7-plus",
    name: "Qwen 3.7 Plus",
    nativeApi: "multimodal",
    input: ["text", "image"],
    contextWindow: MILLION_TOKENS,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxThinkingTokens: 262_144,
  },
  {
    id: "qwen3.7-plus-us",
    name: "Qwen 3.7 Plus US",
    nativeApi: "multimodal",
    baseUrl: "https://dashscope-us.aliyuncs.com/api/v1",
    input: ["text", "image"],
    contextWindow: MILLION_TOKENS,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxThinkingTokens: 262_144,
  },
  {
    id: "qwen3.7-plus-2026-05-26",
    name: "Qwen 3.7 Plus 2026-05-26",
    nativeApi: "multimodal",
    input: ["text", "image"],
    contextWindow: MILLION_TOKENS,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxThinkingTokens: 262_144,
  },
  {
    id: "qwen3.7-flash",
    name: "Qwen 3.7 Flash",
    nativeApi: "multimodal",
    input: ["text", "image"],
    contextWindow: MILLION_TOKENS,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxThinkingTokens: 262_144,
  },
  {
    id: "qwen3.7-flash-2026-07-15",
    name: "Qwen 3.7 Flash 2026-07-15",
    nativeApi: "multimodal",
    input: ["text", "image"],
    contextWindow: MILLION_TOKENS,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxThinkingTokens: 262_144,
  },
];

const QWEN_MODEL_MAP = new Map(QWEN_MODELS.map((model) => [model.id, model]));

interface IntegrationConfig {
  showModelInfo: boolean;
}

interface UsageStore {
  [date: string]: {
    [model: string]: {
      calls: number;
      inputTokens: number;
      outputTokens: number;
    };
  };
}

interface NativeToolCallDelta {
  index?: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string | Record<string, unknown>;
  };
}

interface NativeMessage {
  role?: string;
  content?: string | Array<{ text?: string }>;
  reasoning_content?: string;
  tool_calls?: NativeToolCallDelta[];
}

interface NativeChunk {
  request_id?: string;
  code?: string;
  message?: string;
  output?: {
    choices?: Array<{
      finish_reason?: string | null;
      message?: NativeMessage;
    }>;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens_details?: { reasoning_tokens?: number };
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

interface ToolAccumulator {
  block: ToolCall;
  contentIndex: number;
  partialJson: string;
}

function loadIntegrationConfig(): IntegrationConfig {
  // Off unless explicitly asked for. This used to be `!== "false"`, which meant the
  // footer was appended to every reply by default — and, because it was written into
  // the assistant message before `done`, it was persisted and then replayed on later
  // turns as if the model had written it. Opt-in keeps the transcript honest.
  const showModelInfo = process.env.PI_DASHSCOPE_SHOW_MODEL_INFO === "true";
  try {
    if (fs.existsSync(WECHAT_CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(WECHAT_CONFIG_PATH, "utf8")) as {
        showModelInfo?: boolean;
      };
      return { showModelInfo: config.showModelInfo !== false && showModelInfo };
    }
  } catch {
    // Integration metadata is optional and must not block inference.
  }
  return { showModelInfo };
}

function logUsage(model: string, inputTokens: number, outputTokens: number): void {
  try {
    fs.mkdirSync(path.dirname(USAGE_LOG_PATH), { recursive: true });
    let usage: UsageStore = {};
    if (fs.existsSync(USAGE_LOG_PATH)) {
      usage = JSON.parse(fs.readFileSync(USAGE_LOG_PATH, "utf8")) as UsageStore;
    }
    const date = new Date().toISOString().slice(0, 10);
    usage[date] ??= {};
    usage[date][model] ??= { calls: 0, inputTokens: 0, outputTokens: 0 };
    usage[date][model].calls += 1;
    usage[date][model].inputTokens += inputTokens;
    usage[date][model].outputTokens += outputTokens;
    // Write to a sibling temp file and rename. `writeFileSync` truncates in place, so a
    // crash or a second session writing concurrently can leave a half-written file; the
    // next read then throws, and the bare catch below would leave `usage` as `{}` and
    // overwrite the whole history with a single entry. rename() is atomic within a
    // filesystem, so a reader either sees the old file or the new one.
    const tmp = `${USAGE_LOG_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(usage, null, 2));
    fs.renameSync(tmp, USAGE_LOG_PATH);
  } catch (error) {
    // Usage logging is best effort, but a silent total loss is worse than a loud skip:
    // say so once per process rather than swallowing it entirely.
    if (!warnedUsageWrite) {
      warnedUsageWrite = true;
      console.error(
        `[pi-dashscope-native] usage log not written (${USAGE_LOG_PATH}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

/** 最近一次实际服务的模型 id,供状态栏展示(不写入消息) */
let lastAssistantModelId: string | undefined;

/** 只喊一次:用量日志写不进去时报一次,别刷屏 */
let warnedUsageWrite = false;

function nativeEndpoint(baseUrl: string, nativeApi: NativeApiKind): string {
  const path =
    nativeApi === "multimodal"
      ? "/services/aigc/multimodal-generation/generation"
      : "/services/aigc/text-generation/generation";
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function dataUri(image: ImageContent): string {
  return image.data.startsWith("data:")
    ? image.data
    : `data:${image.mimeType};base64,${image.data}`;
}

function textParts(content: string | Array<TextContent | ImageContent>): string {
  if (typeof content === "string") return content;
  return content
    .filter((part): part is TextContent => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function multimodalParts(
  content: string | Array<TextContent | ImageContent>,
): NativeContentPart[] {
  if (typeof content === "string") return content ? [{ text: content }] : [];
  return content.map((part) =>
    part.type === "text" ? { text: part.text } : { image: dataUri(part) },
  );
}

function assistantText(message: AssistantMessage): string {
  return message.content
    .filter((part): part is TextContent => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function assistantThinking(message: AssistantMessage): string {
  return message.content
    .filter((part): part is ThinkingContent => part.type === "thinking")
    .map((part) => part.thinking)
    .join("\n");
}

function assistantToolCalls(message: AssistantMessage): Array<Record<string, unknown>> {
  return message.content
    .filter((part): part is ToolCall => part.type === "toolCall")
    .map((part, index) => ({
      id: part.id,
      index,
      type: "function",
      function: {
        name: part.name,
        arguments: JSON.stringify(part.arguments),
      },
    }));
}

type RawContent = string | Array<TextContent | ImageContent>;

function toRawContent(
  content: string | Array<TextContent | ImageContent | ThinkingContent | ToolCall>,
): RawContent {
  if (typeof content === "string") return content;
  return content.filter(
    (part): part is TextContent | ImageContent =>
      part.type === "text" || part.type === "image",
  );
}

function convertMessage(
  message: {
    role: string;
    content: string | Array<TextContent | ImageContent | ThinkingContent | ToolCall>;
    toolCallId?: string;
  },
  nativeApi: NativeApiKind,
): Record<string, unknown> {
  const multimodal = nativeApi === "multimodal";
  const content = toRawContent(message.content);

  if (message.role === "assistant") {
    const assistant = message as unknown as AssistantMessage;
    const text = assistantText(assistant);
    const thinking = assistantThinking(assistant);
    const toolCalls = assistantToolCalls(assistant);
    return {
      role: "assistant",
      content: multimodal ? (text ? [{ text }] : []) : text,
      ...(thinking ? { reasoning_content: thinking } : {}),
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    };
  }

  if (message.role === "toolResult") {
    if (!multimodal && Array.isArray(content) && content.some((part) => part.type === "image")) {
      throw new Error("The selected Qwen model cannot receive image tool results");
    }
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: multimodal ? multimodalParts(content) : textParts(content),
    };
  }

  if (message.role !== "user" && message.role !== "system") {
    throw new Error(`Unsupported message role for DashScope: ${message.role}`);
  }
  if (!multimodal && Array.isArray(content) && content.some((part) => part.type === "image")) {
    throw new Error("The selected Qwen model accepts text input only");
  }
  return {
    role: message.role,
    content: multimodal ? multimodalParts(content) : textParts(content),
  };
}

interface NormalizedTranscript {
  messages: Array<Record<string, unknown>>;
  tools: Tool[];
}

/**
 * Pi hands a custom provider a transcript whose prompt and tool declarations live
 * in `system` messages rather than in `Context.systemPrompt` / `Context.tools`.
 * Resolve both shapes: collect the prompt and tool deltas, then emit one leading
 * system message plus the conversation.
 */
function normalizeTranscript(context: Context, nativeApi: NativeApiKind): NormalizedTranscript {
  const raw = context as unknown as { messages?: unknown[]; systemPrompt?: string; tools?: Tool[] };
  const incoming = raw.messages ?? [];

  const promptTexts: string[] = [];
  if (typeof context.systemPrompt === "string" && context.systemPrompt.length > 0) {
    promptTexts.push(context.systemPrompt);
  }

  const sections = new Map<string, string>();
  const tools = new Map<string, Tool>();
  for (const tool of raw.tools ?? []) tools.set(tool.name, tool);

  const conversation: Array<{
    role: string;
    content: string | Array<TextContent | ImageContent | ThinkingContent | ToolCall>;
    toolCallId?: string;
  }> = [];

  for (const entry of incoming) {
    const message = entry as Record<string, unknown>;
    const role = typeof message.role === "string" ? message.role : undefined;
    if (!role) continue;

    if (role === "system") {
      const content = message.content as string | TextContent[] | undefined;
      const text = content === undefined
        ? ""
        : typeof content === "string"
          ? content
          : content.filter((part): part is TextContent => part.type === "text")
            .map((part) => part.text)
            .join("\n");
      if (text.length > 0) promptTexts.push(text);

      for (const [name, value] of Object.entries(
        (message.sections as Record<string, string | null> | undefined) ?? {},
      )) {
        if (value === null) sections.delete(name);
        else sections.set(name, value);
      }
      for (const tool of (message.toolsAdded as Tool[] | undefined) ?? []) {
        tools.set(tool.name, tool);
      }
      for (const tool of (message.toolsRemoved as Array<{ name: string }> | undefined) ?? []) {
        tools.delete(tool.name);
      }
      continue;
    }

    conversation.push({
      role,
      content: message.content as string | Array<TextContent | ImageContent>,
      ...(typeof message.toolCallId === "string" ? { toolCallId: message.toolCallId } : {}),
    });
  }

  const messages: Array<Record<string, unknown>> = [];
  const prompt = [...promptTexts, ...sections.values()].filter((part) => part.length > 0).join("\n\n");
  if (prompt.length > 0) {
    messages.push({
      role: "system",
      content: nativeApi === "multimodal" ? [{ text: prompt }] : prompt,
    });
  }
  messages.push(...conversation.map((message) => convertMessage(message, nativeApi)));

  return { messages, tools: [...tools.values()] };
}

function convertTools(tools: Tool[]): Array<Record<string, unknown>> | undefined {
  if (tools.length === 0) return undefined;
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

function thinkingBudget(
  config: QwenModelConfig,
  options: SimpleStreamOptions | undefined,
): number | undefined {
  const level = options?.reasoning;
  if (!config.forcedThinking && !level) return undefined;

  const custom = level && level in (options?.thinkingBudgets ?? {})
    ? options?.thinkingBudgets?.[level as keyof NonNullable<SimpleStreamOptions["thinkingBudgets"]>]
    : undefined;
  const defaults: Record<string, number> = {
    minimal: 1_024,
    low: 4_096,
    medium: 16_384,
    high: 65_536,
    xhigh: 131_072,
    max: config.maxThinkingTokens,
  };
  return Math.min(custom ?? defaults[level ?? "medium"], config.maxThinkingTokens);
}

async function buildPayload(
  model: Model<Api>,
  config: QwenModelConfig,
  context: Context,
  options: SimpleStreamOptions | undefined,
): Promise<Record<string, unknown>> {
  const budget = thinkingBudget(config, options);
  const thinkingEnabled = config.forcedThinking || options?.reasoning !== undefined;
  const transcript = normalizeTranscript(context, config.nativeApi);
  const tools = convertTools(transcript.tools);
  const parameters: Record<string, unknown> = {
    result_format: "message",
    incremental_output: true,
    max_tokens: Math.min(options?.maxTokens ?? model.maxTokens, model.maxTokens),
    enable_thinking: thinkingEnabled,
    preserve_thinking: thinkingEnabled,
    ...(thinkingEnabled && budget !== undefined ? { thinking_budget: budget } : {}),
    ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(model.samplingParams ?? {}),
    ...(options?.samplingParams ?? {}),
    ...(tools ? { tools, parallel_tool_calls: true } : {}),
    ...(options?.toolChoice ? { tool_choice: options.toolChoice } : {}),
  };
  const payload: Record<string, unknown> = {
    model: model.id,
    input: { messages: transcript.messages },
    parameters,
  };
  return (await options?.onPayload?.(payload, model)) as Record<string, unknown> | undefined ?? payload;
}

function responseHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

function mergeHeaders(
  apiKey: string,
  custom?: Record<string, string | null>,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-DashScope-SSE": "enable",
  };
  for (const [key, value] of Object.entries(custom ?? {})) {
    if (value === null) delete headers[key];
    else headers[key] = value;
  }
  return headers;
}

function combineSignals(...signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
  const active = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];

  const controller = new AbortController();
  const abort = (signal: AbortSignal) => controller.abort(signal.reason);
  for (const signal of active) {
    if (signal.aborted) {
      abort(signal);
      break;
    }
    signal.addEventListener("abort", () => abort(signal), { once: true });
  }
  return controller.signal;
}

function sseData(block: string): string | undefined {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  return data || undefined;
}

async function* nativeChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<NativeChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const separator = buffer.match(/\r?\n\r?\n/);
        if (separator?.index === undefined) break;
        const block = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const data = sseData(block);
        if (data && data !== "[DONE]") yield JSON.parse(data) as NativeChunk;
      }
    }

    buffer += decoder.decode();
    const data = sseData(buffer);
    if (data && data !== "[DONE]") yield JSON.parse(data) as NativeChunk;
  } finally {
    reader.releaseLock();
  }
}

function nativeText(content: NativeMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => part.text ?? "").join("");
}

function stopReason(reason: string | null | undefined): StopReason | undefined {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "tool_calls":
      return "toolUse";
    case null:
    case undefined:
    case "null":
      return undefined;
    default:
      return "error";
  }
}

function updateUsage(output: AssistantMessage, chunk: NativeChunk): void {
  if (!chunk.usage) return;
  output.usage.input = chunk.usage.input_tokens ?? output.usage.input;
  output.usage.output = chunk.usage.output_tokens ?? output.usage.output;
  output.usage.cacheRead =
    chunk.usage.prompt_tokens_details?.cached_tokens
    ?? chunk.usage.input_tokens_details?.cached_tokens
    ?? output.usage.cacheRead;
  output.usage.reasoning =
    chunk.usage.output_tokens_details?.reasoning_tokens ?? output.usage.reasoning;
  output.usage.totalTokens =
    chunk.usage.total_tokens
    ?? output.usage.input + output.usage.output + output.usage.cacheRead + output.usage.cacheWrite;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasConfiguredApiKey(): boolean {
  try {
    const modelsPath = path.join(CONFIG_DIR, "models.json");
    const models = JSON.parse(fs.readFileSync(modelsPath, "utf8")) as {
      providers?: Record<string, { apiKey?: unknown }>;
    };
    const apiKey = models.providers?.[PROVIDER_ID]?.apiKey;
    return typeof apiKey === "string" && apiKey.length > 0;
  } catch {
    return false;
  }
}

export function streamDashScopeNative(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  const integration = loadIntegrationConfig();

  void (async () => {
    const output: AssistantMessage = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "pending",
      timestamp: Date.now(),
    };

    let thinkingIndex: number | undefined;
    let textIndex: number | undefined;
    const toolCalls = new Map<number, ToolAccumulator>();

    const endThinking = () => {
      if (thinkingIndex === undefined) return;
      const block = output.content[thinkingIndex] as ThinkingContent;
      stream.push({ type: "thinking_end", contentIndex: thinkingIndex, content: block.thinking, partial: output });
      thinkingIndex = undefined;
    };

    const endText = () => {
      if (textIndex === undefined) return;
      const block = output.content[textIndex] as TextContent;
      stream.push({ type: "text_end", contentIndex: textIndex, content: block.text, partial: output });
      textIndex = undefined;
    };

    const finishToolCalls = () => {
      for (const { block, contentIndex, partialJson } of toolCalls.values()) {
        try {
          // Pi 1.0.0 narrowed `ToolCall.arguments` from `Record<string, any>` to the
          // closed `JsonObject` union, so the parsed value needs an explicit cast.
          block.arguments = (partialJson ? JSON.parse(partialJson) : {}) as JsonObject;
        } catch {
          block.arguments = { _raw: partialJson };
        }
        stream.push({ type: "toolcall_end", contentIndex, toolCall: block, partial: output });
      }
      toolCalls.clear();
    };

    try {
      const config = QWEN_MODEL_MAP.get(model.id);
      if (!config) throw new Error(`Unsupported DashScope Native model: ${model.id}`);
      const apiKey = config.baseUrl?.includes("dashscope-us.aliyuncs.com")
        ? options?.env?.DASHSCOPE_US_API_KEY ?? process.env.DASHSCOPE_US_API_KEY
        : options?.apiKey;
      if (!apiKey) {
        const keyName = config.baseUrl?.includes("dashscope-us.aliyuncs.com")
          ? "DASHSCOPE_US_API_KEY"
          : "a DashScope API key";
        throw new Error(`No ${keyName} configured for ${PROVIDER_ID}`);
      }

      const payload = await buildPayload(model, config, context, options);
      const timeoutSignal = options?.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined;
      const signal = combineSignals(options?.signal, timeoutSignal);
      const fetchImpl = options?.fetch ?? globalThis.fetch;

      stream.push({ type: "start", partial: output });
      const response = await fetchImpl(nativeEndpoint(model.baseUrl, config.nativeApi), {
        method: "POST",
        headers: mergeHeaders(apiKey, options?.headers),
        body: JSON.stringify(payload),
        signal,
      });
      await options?.onResponse?.({ status: response.status, headers: responseHeaders(response.headers) }, model);

      if (!response.ok) {
        const body = (await response.text()).slice(0, 8_192);
        throw new Error(`DashScope API error ${response.status}: ${body}`);
      }
      if (!response.body) throw new Error("DashScope returned an empty response body");

      for await (const chunk of nativeChunks(response.body)) {
        if (chunk.code) throw new Error(`DashScope ${chunk.code}: ${chunk.message ?? "request failed"}`);
        if (chunk.request_id) output.responseId = chunk.request_id;
        updateUsage(output, chunk);

        const choice = chunk.output?.choices?.[0];
        const nativeMessage = choice?.message;
        const reasoning = nativeMessage?.reasoning_content ?? "";
        const content = nativeText(nativeMessage?.content);

        if (reasoning) {
          if (thinkingIndex === undefined) {
            thinkingIndex = output.content.length;
            output.content.push({ type: "thinking", thinking: "" });
            stream.push({ type: "thinking_start", contentIndex: thinkingIndex, partial: output });
          }
          const block = output.content[thinkingIndex] as ThinkingContent;
          block.thinking += reasoning;
          stream.push({ type: "thinking_delta", contentIndex: thinkingIndex, delta: reasoning, partial: output });
        }

        if (content) {
          endThinking();
          if (textIndex === undefined) {
            textIndex = output.content.length;
            output.content.push({ type: "text", text: "" });
            stream.push({ type: "text_start", contentIndex: textIndex, partial: output });
          }
          const block = output.content[textIndex] as TextContent;
          block.text += content;
          stream.push({ type: "text_delta", contentIndex: textIndex, delta: content, partial: output });
        }

        for (const [position, delta] of (nativeMessage?.tool_calls ?? []).entries()) {
          endThinking();
          endText();
          const index = delta.index ?? position;
          let accumulator = toolCalls.get(index);
          if (!accumulator) {
            const block: ToolCall = {
              type: "toolCall",
              id: delta.id || `call_${crypto.randomUUID().replaceAll("-", "")}`,
              name: delta.function?.name ?? "",
              arguments: {},
            };
            const contentIndex = output.content.length;
            output.content.push(block);
            accumulator = { block, contentIndex, partialJson: "" };
            toolCalls.set(index, accumulator);
            stream.push({ type: "toolcall_start", contentIndex, partial: output });
          }
          if (delta.id) accumulator.block.id = delta.id;
          if (delta.function?.name) accumulator.block.name = delta.function.name;
          const argumentDelta = typeof delta.function?.arguments === "string"
            ? delta.function.arguments
            : delta.function?.arguments
              ? JSON.stringify(delta.function.arguments)
              : "";
          if (argumentDelta) {
            accumulator.partialJson += argumentDelta;
            try {
              accumulator.block.arguments = JSON.parse(accumulator.partialJson) as JsonObject;
            } catch {
              // Arguments are commonly incomplete until the final tool-call chunk.
            }
            stream.push({
              type: "toolcall_delta",
              contentIndex: accumulator.contentIndex,
              delta: argumentDelta,
              partial: output,
            });
          }
        }

        const mappedReason = stopReason(choice?.finish_reason);
        if (mappedReason) {
          output.stopReason = mappedReason;
          output.rawStopReason = choice?.finish_reason ?? undefined;
        }
      }

      if (output.stopReason === "pending") {
        throw new Error("DashScope stream ended without a stop reason");
      }
      if (output.stopReason === "error") {
        throw new Error(`DashScope returned an unsupported stop reason: ${output.rawStopReason ?? "unknown"}`);
      }
      if (
        output.stopReason !== "stop"
        && output.stopReason !== "length"
        && output.stopReason !== "toolUse"
      ) {
        throw new Error(`DashScope returned an invalid terminal state: ${output.stopReason}`);
      }

      endThinking();
      finishToolCalls();
      // The footer is display-only. Appending it to `output.content` here would fold it
      // into the persisted assistant message and replay it as the model's own prior
      // text on every later turn, inflating the transcript with a fabricated turn.
      // `registerMarkdownTransformer` renders it without touching what is stored.
      if (
        integration.showModelInfo
        && output.stopReason !== "toolUse"
        && textIndex !== undefined
      ) {
        lastAssistantModelId = model.id;
      } else {
        lastAssistantModelId = undefined;
      }
      endText();
      calculateCost(model, output.usage);
      logUsage(model.id, output.usage.input, output.usage.output);
      stream.push({ type: "done", reason: output.stopReason, message: output });
      stream.end();
    } catch (error) {
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage = errorMessage(error);
      stream.push({ type: "error", reason: output.stopReason, error: output });
      stream.end();
    }
  })();

  return stream;
}

export default function registerDashScopeNative(pi: ExtensionAPI): void {
  pi.registerProvider(PROVIDER_ID, {
    name: "Alibaba Qwen DashScope Native",
    baseUrl: DEFAULT_BASE_URL,
    api: "dashscope-native",
    ...(!hasConfiguredApiKey() ? { apiKey: "$DASHSCOPE_API_KEY" } : {}),
    models: QWEN_MODELS.map((model) => ({
      id: model.id,
      name: `${model.name} (Native)`,
      ...(model.baseUrl ? { baseUrl: model.baseUrl } : {}),
      reasoning: true,
      thinkingLevelMap: {
        ...(model.forcedThinking ? { off: null } : {}),
        xhigh: "xhigh",
        max: "max",
      },
      input: model.input,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      cost: ZERO_COST,
    })),
    streamSimple: streamDashScopeNative,
  });

  // 模型信息只在状态栏展示,不进消息内容。
  // 之前是追加到助手消息文本上再 emit text_delta —— 那会把 footer 写进会话记录,
  // 之后每一轮都作为“模型自己说过的话”重放。展示层的事不该落到会话里。
  const integration = loadIntegrationConfig();
  if (integration.showModelInfo) {
    pi.on("message_end", (_event, ctx) => {
      if (!lastAssistantModelId) return;
      const name = QWEN_MODEL_MAP.get(lastAssistantModelId)?.name ?? lastAssistantModelId;
      ctx.ui.setStatus("dashscope-native", `${name} · DashScope Native`);
    });

    pi.on("session_start", (_event, ctx) => {
      ctx.ui.setStatus("dashscope-native", undefined);
    });
  }

  console.log(`[pi-dashscope-native] Registered ${QWEN_MODELS.length} Qwen 3.7+ models over DashScope Native API`);
}
