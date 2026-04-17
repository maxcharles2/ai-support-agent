# AI Support Agent

A Next.js playground for comparing two AI response evaluation frameworks side-by-side: **AI SDK structured output scoring** and **LangSmith tracing with feedback**.

## Overview

This app lets you chat with an AI support assistant and immediately evaluate response quality using one of two approaches:

- **AI SDK Structured Output** — an LLM-as-judge pipeline that uses Vercel AI SDK's `generateText` with a Zod schema to produce structured scores entirely within the app.
- **LangSmith Traced Evaluation** — every chat run is traced via LangSmith's `traceable` wrapper and `wrapAISDK`, and evaluation feedback scores are attached to the parent run in the LangSmith dashboard.

## Architecture

```
/ (Home)
├── /api/ui/stream          AI SDK chat UI
│   ├── POST /api/stream    streamText (OpenRouter)
│   └── POST /api/evaluate  generateText + Zod schema (GPT-4.1 mini judge)
│
└── /api/ui/langsmith       LangSmith chat UI
    ├── POST /api/langsmith/stream    wrapAISDK + traceable streamText → x-langsmith-run-id header
    └── POST /api/langsmith/evaluate  traceable generateText + Client.createFeedback()
```

Both chat windows use the same models (configured in `src/lib/models.ts`) and share an identical UI layout, differing only in their backend routes and evaluation approach.

## Prerequisites

- Node.js 18+
- An [OpenRouter](https://openrouter.ai) account and API key (for chat models)
- An [OpenAI](https://platform.openai.com) API key (for the GPT-4.1 mini evaluator judge)
- A [LangSmith](https://smith.langchain.com) account and API key (for the LangSmith evaluation flow)

## Getting Started

1. **Clone and install dependencies**

   ```bash
   git clone <repo-url>
   cd ai-support-agent
   npm install
   ```

2. **Set up environment variables**

   Create a `.env.local` file in the project root:

   ```bash
   # OpenRouter — used for chat model inference
   RC_OPENROUTER_API_KEY=sk-or-v1-...

   # OpenAI — used for the LLM-as-judge evaluator (gpt-4.1-mini)
   OPENAI_API_KEY=sk-proj-...

   # LangSmith — required for the LangSmith evaluation flow
   LANGSMITH_API_KEY=lsv2_pt_...
   LANGSMITH_TRACING=true

   # Optional: group traces under a named project in LangSmith (defaults to "default")
   # LANGCHAIN_PROJECT=my-project
   ```

3. **Run the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the home page.

## Evaluation Approaches

### AI SDK Structured Output (`/api/ui/stream`)

1. Send a message — the request hits `POST /api/stream`, which calls `streamText` via OpenRouter.
2. Click **Evaluate** — the request hits `POST /api/evaluate`, which calls `generateText` (GPT-4.1 mini) with an `Output.object` Zod schema.
3. The evaluator returns a structured `{ score, strengths, weaknesses, summary }` object rendered directly in the UI.

No external observability service is required; everything stays within the app.

### LangSmith Traced Evaluation (`/api/ui/langsmith`)

1. Send a message — the request hits `POST /api/langsmith/stream`. The `streamText` call is wrapped with `wrapAISDK` and run inside a `traceable` function named `"chat-stream"`. The LangSmith run ID is returned in the `x-langsmith-run-id` response header.
2. Click **Evaluate** — the request hits `POST /api/langsmith/evaluate` with the `runId`. The judge call runs inside its own `traceable` function (`"chat-evaluation"`), and `Client.createFeedback()` attaches the quality score to the parent run.
3. The evaluation card shows the same structured result plus a direct **View in LangSmith** link to the run.

All traces appear in your [LangSmith dashboard](https://smith.langchain.com) under the configured project.

## Route Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Home page — links to both chat UIs |
| `GET` | `/api/ui/stream` | AI SDK structured output chat UI |
| `GET` | `/api/ui/langsmith` | LangSmith traced evaluation chat UI |
| `POST` | `/api/stream` | Streams a chat response via OpenRouter |
| `POST` | `/api/evaluate` | Evaluates a response with structured output (GPT-4.1 mini) |
| `POST` | `/api/langsmith/stream` | Streams a chat response with LangSmith tracing; returns `x-langsmith-run-id` header |
| `POST` | `/api/langsmith/evaluate` | Evaluates and attaches feedback to a LangSmith run |

## Models

Chat models are defined in `src/lib/models.ts` and served through OpenRouter. The default model list:

| Model ID | Display Name |
|----------|-------------|
| `deepseek/deepseek-r1` | DeepSeek: R1 |
| `qwen/qwen-2.5-7b-instruct` | Qwen: Qwen2.5 7B Instruct |

To add or swap models, edit the `MODELS` array in `src/lib/models.ts`.

## Viewing Results in LangSmith

1. Go to [smith.langchain.com](https://smith.langchain.com) and sign in.
2. Navigate to **Projects** → select your project (default: `"default"`).
3. Each chat run appears as a `"chat-stream"` trace. Expanding a run shows the streamed messages.
4. After evaluating, the run's **Feedback** tab shows the `quality` score (0–1) and the evaluator's comment with strengths and weaknesses.
5. From the LangSmith chat UI, you can also click the **View in LangSmith** button in the evaluation card to jump directly to the run.
