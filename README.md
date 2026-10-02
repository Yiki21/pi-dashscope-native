# pi-dashscope-native

Pi provider for Alibaba Cloud's native DashScope Qwen API.

## Installation

Install from npm:

```bash
pi install npm:pi-dashscope-native
```

To pin a specific release:

```bash
pi install npm:pi-dashscope-native@0.2.1
```

The package is listed in [Pi Packages](https://pi.dev/packages/pi-dashscope-native).

You can also install the tagged GitHub release:

```bash
pi install git:github.com/Yiki21/pi-dashscope-native@v0.2.1
```

To track the repository's default branch instead of a release tag:

```bash
pi install git:github.com/Yiki21/pi-dashscope-native
```

## Protocol

The provider calls DashScope directly instead of using an OpenAI or Anthropic compatibility layer:

- Text: `/api/v1/services/aigc/text-generation/generation`
- Multimodal: `/api/v1/services/aigc/multimodal-generation/generation`
- Streaming: DashScope SSE with incremental output

It maps Pi messages, images, thinking blocks, tools, tool results, stop reasons, and token usage to the native request and response formats.

## Authentication

Set an environment variable before starting Pi:

```bash
export DASHSCOPE_API_KEY="sk-..."
```

Alternatively, store a key through Pi:

```text
/login alibaba-qwen-dashscope-native
```

You can instead configure an API key in `~/.pi/agent/models.json`:

```json
{
  "providers": {
    "alibaba-qwen-dashscope-native": {
      "baseUrl": "https://dashscope.aliyuncs.com/api/v1",
      "apiKey": "$DASHSCOPE_API_KEY"
    }
  }
}
```

An explicit `apiKey` under this Provider in `models.json` takes precedence over the package's environment-variable fallback.

## Models

The provider registers every Qwen 3.7 and 3.8 model currently listed by Alibaba Cloud Model Studio.

### Qwen 3.8

- `qwen3.8-max`
- `qwen3.8-flash`
- `qwen3.8-2.4t-a95b`
- `qwen3.8-27b`

### Qwen 3.7

- `qwen3.7-max`
- `qwen3.7-max-us`
- `qwen3.7-max-2026-06-08`
- `qwen3.7-max-2026-05-20`
- `qwen3.7-max-preview`
- `qwen3.7-max-2026-05-17`
- `qwen3.7-plus`
- `qwen3.7-plus-us`
- `qwen3.7-plus-2026-05-26`
- `qwen3.7-flash`
- `qwen3.7-flash-2026-07-15`

All models use a 1M-token context window. `qwen3.7-max-preview` and `qwen3.7-max-2026-05-17` cap output at 65536 tokens; every other model allows 131072. The `-us` model IDs use the Virginia DashScope endpoint and require `DASHSCOPE_US_API_KEY`; the other IDs use the Beijing endpoint and the Provider's configured key. Pi exposes image input only for models whose official model card includes image and video input. Pi does not currently expose video as a provider input type.

`qwen3.7-max-preview` and `qwen3.7-max-2026-05-17` are thinking-only models. The provider hides Pi's `off` thinking level for them.

### Endpoints

DashScope exposes two service paths, and a given model is served by exactly one of them. The provider picks the path from each model's `nativeApi`, which is pinned to the endpoint the model actually answers on:

| Path | Models |
| --- | --- |
| `multimodal-generation/generation` | all Qwen 3.8 models, `qwen3.7-plus*`, `qwen3.7-flash*`, `qwen3.7-max-2026-06-08` |
| `text-generation/generation` | `qwen3.7-max`, `qwen3.7-max-us`, `qwen3.7-max-2026-05-20`, `qwen3.7-max-preview`, `qwen3.7-max-2026-05-17` |

Calling the wrong path answers with `InvalidParameter: url error, please check url`, not with a message about the model.

## Thinking levels

Pi thinking levels map to native `enable_thinking` and `thinking_budget` parameters:

| Pi level | Budget |
| --- | ---: |
| `minimal` | 1024 |
| `low` | 4096 |
| `medium` | 16384 |
| `high` | 65536 |
| `xhigh` | 131072 |
| `max` | Model maximum, up to 262144 |

Custom Pi thinking budgets override these defaults and are clamped to each model's documented limit.

A transcript's prompt and tool declarations are rebuilt into one leading `system` message per request: Pi delivers both through the transcript rather than through `Context.systemPrompt` and `Context.tools`, and tool declarations arrive as `toolsAdded` / `toolsRemoved` deltas on `system` messages.

## Usage

```bash
pi --list-models | rg '^alibaba-qwen-dashscope-native'
pi --provider alibaba-qwen-dashscope-native --model qwen3.8-flash
pi --provider alibaba-qwen-dashscope-native --model qwen3.8-max:off "Reply with OK"
```

The Provider supports:

- Incremental text and thinking streams
- Function calling, parallel tool calls, and tool results
- Text and base64 image input
- Preserved thinking in multi-turn conversations
- Pi request and response lifecycle hooks
- Local token usage logging in `usage.json`

Model costs remain zero in Pi because the configured Model Studio prices are denominated in CNY while Pi's cost display assumes USD.

### Model info in the status bar

Set `PI_DASHSCOPE_SHOW_MODEL_INFO=true` to show which Qwen model served the last reply in Pi's status bar:

```bash
PI_DASHSCOPE_SHOW_MODEL_INFO=true pi --provider alibaba-qwen-dashscope-native --model qwen3.8-max
```

This is display-only. An earlier version appended the same information to the reply text itself, which put it into the session record, so it was replayed on later turns as if the model had written it. It is now off by default and never touches message content.

`usage.json` is written atomically (temp file plus rename), so a crash or two sessions writing at once can no longer truncate the history. A write that fails is reported once on stderr instead of being dropped silently.

## Endpoint override

Override `baseUrl` in `models.json` to use a workspace or another Model Studio region. The value must end at `/api/v1`; the provider appends the correct text or multimodal service path.

## References

- [DashScope native API](https://help.aliyun.com/zh/model-studio/qwen-api-via-dashscope)
- [Qwen model catalog](https://docs.qwencloud.com/developer-guides/getting-started/text-generation-models)
- [Pi custom providers](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/custom-provider.md)
