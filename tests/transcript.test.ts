/**
 * Regression tests for pi-dashscope-native.
 *
 * Run: node --experimental-strip-types --test tests/
 *
 * These cover the two defects found in review, both of which were silent:
 *
 *   1. the transcript rebuild (tool calls, tool results, system prompt) — a rebuild
 *      that drops `tools` or reorders turns produces a provider request that still
 *      succeeds, so nothing fails loudly;
 *   2. the model-info footer, which used to be appended to the assistant message and
 *      therefore persisted and replayed as the model's own earlier text.
 *
 * Nothing here talks to DashScope. The provider is driven with a fake `fetch`.
 */
import test from "node:test";
import assert from "node:assert/strict";

import registerDashScopeNative, { QWEN_MODELS, streamDashScopeNative } from "../src/index.ts";

/**
 * Build the SSE body DashScope returns for a plain text answer.
 *
 * The parser reads `output.choices[0].message.content` and takes the terminal state from
 * `choices[0].finish_reason`, so the final chunk must carry `finish_reason` or the stream
 * ends with "DashScope stream ended without a stop reason".
 */
function textStreamBody(text: string) {
  return [
    `data: ${JSON.stringify({
      request_id: "req-test",
      output: {
        choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop" }],
      },
      usage: { input_tokens: 11, output_tokens: 2 },
    })}\n`,
    "data: [DONE]\n",
  ].join("\n");
}

const MODEL = {
  id: "qwen3.8-flash",
  name: "Qwen 3.8 Flash",
  api: "dashscope-native",
  provider: "alibaba-qwen-dashscope-native",
  baseUrl: "https://dashscope.aliyuncs.com/api/v1",
  reasoning: true,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1000000,
  maxTokens: 65536,
};

/**
 * Run one stream against a fake transport and return the request body that was sent
 * plus the assistant message that came out.
 */
async function runStream(context: Record<string, unknown>, respond = textStreamBody("OK")) {
  let sent: Record<string, unknown> | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    return new Response(respond, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }) as typeof globalThis.fetch;

  try {
    const stream = streamDashScopeNative(MODEL as never, context as never, {
      apiKey: "test-key",
    } as never);
    const events = [];
    for await (const event of stream) events.push(event);
    const done = events.find((event) => event.type === "done") as
      | { message: { content: unknown[] } }
      | undefined;
    return { sent, events, message: done?.message };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/** The 1.0.0 transcript: prompt and tools live in a leading `system` message. */
function transcript100(overrides: Record<string, unknown> = {}) {
  return {
    messages: [
      {
        role: "system",
        content: "You are a helpful agent.",
        toolsAdded: [
          {
            name: "read",
            description: "Read a file",
            parameters: { type: "object", properties: { path: { type: "string" } } },
          },
        ],
        timestamp: 0,
        ...overrides,
      },
      { role: "user", content: "list the files" },
    ],
  };
}

test("registers every model on the native api", () => {
  const calls: Array<{ id: string; config: Record<string, unknown> }> = [];
  const handlers: Record<string, unknown> = {};
  registerDashScopeNative({
    registerProvider(id: string, config: Record<string, unknown>) {
      calls.push({ id, config });
    },
    on(event: string, handler: unknown) {
      handlers[event] = handler;
    },
  } as never);

  assert.equal(calls.length, 1, "exactly one provider registration");
  const { id, config } = calls[0];
  assert.equal(id, "alibaba-qwen-dashscope-native");
  assert.equal(config.api, "dashscope-native");
  const models = config.models as Array<{ id: string }>;
  assert.equal(models.length, QWEN_MODELS.length);
  assert.equal(typeof config.streamSimple, "function");
});

test("sends the system prompt from a 1.0.0 transcript", async () => {
  const { sent } = await runStream(transcript100());
  const input = sent?.input as { messages?: Array<{ role: string; content: unknown }> };
  assert.ok(Array.isArray(input?.messages), "the request carries a message list");
  const system = input.messages.find((m) => m.role === "system");
  assert.ok(system, "a system message must be sent");
  assert.equal(
    JSON.stringify(system.content).includes("You are a helpful agent."),
    true,
    "the prompt text must survive the rebuild",
  );
});

test("sends the tool declarations from a 1.0.0 transcript", async () => {
  const { sent } = await runStream(transcript100());
  const parameters = sent?.parameters as
    | { tools?: Array<{ type: string; function?: { name?: string } }> }
    | undefined;
  const tools = parameters?.tools;
  assert.ok(Array.isArray(tools) && tools.length > 0, "tools must not be dropped");
  assert.deepEqual(
    tools.map((tool) => tool.function?.name),
    ["read"],
    "the declared tool must reach DashScope",
  );
});

test("sends no system message when the transcript has no prompt", async () => {
  const { sent } = await runStream({ messages: [{ role: "user", content: "hi" }] });
  const input = sent?.input as { messages: Array<{ role: string }> };
  assert.equal(
    input.messages.some((m) => m.role === "system"),
    false,
    "an absent prompt must not become an empty system message",
  );
});

test("tool results reach the provider as tool messages", async () => {
  const { sent } = await runStream({
    messages: [
      { role: "system", content: "P", timestamp: 0 },
      { role: "user", content: "read it" },
      {
        role: "assistant",
        content: [
          { type: "toolCall", id: "call_1", name: "read", arguments: { path: "a.txt" } },
        ],
      },
      {
        role: "toolResult",
        toolCallId: "call_1",
        content: [{ type: "text", text: "FILE CONTENTS" }],
      },
    ],
  });
  const serialized = JSON.stringify(sent);
  assert.equal(serialized.includes("FILE CONTENTS"), true, "tool result text must be sent");
});

test("preserves assistant tool calls in the request", async () => {
  const { sent } = await runStream({
    messages: [
      { role: "system", content: "P", timestamp: 0 },
      { role: "user", content: "read it" },
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "call_9", name: "read", arguments: { path: "b.txt" } }],
      },
    ],
  });
  const serialized = JSON.stringify(sent);
  assert.equal(serialized.includes("call_9"), true, "tool call id must be preserved");
  assert.equal(serialized.includes("b.txt"), true, "tool call arguments must be preserved");
});

test("does not write a model-info footer into the assistant message", async () => {
  const { message } = await runStream(transcript100(), textStreamBody("DONE"));
  const text = JSON.stringify(message?.content ?? []);
  assert.equal(
    /DashScope Native API|Provider:|模型:/.test(text),
    false,
    "the footer must never enter message content — it would be persisted and replayed",
  );
  assert.equal(text.includes("DONE"), true, "the real answer is still there");
});

test("returns the streamed text unchanged", async () => {
  const { message } = await runStream(transcript100(), textStreamBody("HELLO"));
  const parts = (message?.content ?? []) as Array<{ type: string; text?: string }>;
  const text = parts.filter((p) => p.type === "text").map((p) => p.text).join("");
  assert.equal(text, "HELLO");
});
