# AI Engineering Sprint — 14 Days

A focused, ship-something-daily sprint to go from "experienced Node.js/DevOps engineer" to "dangerous AI Engineer." Built in TypeScript (Week 1) and Python (Week 2).

> Full curriculum: [`docs/curriculum.md`](docs/curriculum.md)

---

## Prerequisites

- Node.js >= 20
- A free API key from Groq or Google (no credit card required)
- 4–6 focused hours per day for 14 days

---

## Get a free API key (no credit card)

Pick one — both work for the entire 14-day sprint:

| Provider | Free tier | Get key | Notes |
|----------|-----------|---------|-------|
| **Groq** (default) | ~14,400 req/day | [console.groq.com/keys](https://console.groq.com/keys) | Fastest inference on the planet. Sign in with Google. |
| **Google Gemini** | 1,500 req/day | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Very generous, smart models. |
| OpenAI (paid) | None free | [platform.openai.com](https://platform.openai.com/api-keys) | ~$5 prepaid lasts the full sprint with `gpt-4o-mini`. |
| Anthropic (paid) | None free | [console.anthropic.com](https://console.anthropic.com) | ~$5 prepaid; use `claude-3-5-haiku-latest`. |

---

## Setup

```bash
npm install
cp .env.example .env
# Open .env, paste your GROQ_API_KEY (default), or switch LLM_PROVIDER to google/openai/anthropic
```

---

## Day 1 — Streaming chatbot with tool calling

```bash
npm run day-01
```

Try these prompts:

- `What is (1234 * 9) / 3?` — exercises the calculator tool
- `What time is it right now?` — exercises the current-time tool
- `Explain embeddings in 3 sentences.` — pure LLM, no tools

Type `:exit` or Ctrl+C to quit.

### What you'll learn on Day 1

- Streaming responses with the Vercel AI SDK
- Multi-turn conversation state in the CLI
- Tool calling (function calling) with Zod-validated parameters
- Token usage tracking
- Provider abstraction (swap OpenAI ↔ Anthropic via `LLM_PROVIDER` env var)

---

## Project layout

```
.
├── docs/
│   └── curriculum.md           # Full 14-day plan
├── src/
│   ├── config/
│   │   └── env.ts              # Zod-validated env (fail fast at startup)
│   ├── lib/
│   │   ├── llm.ts              # Provider factory (OpenAI / Anthropic)
│   │   └── logger.ts           # Typed JSON logger with secret redaction
│   └── day-01-chatbot/
│       ├── index.ts            # Streaming CLI chatbot
│       └── tools.ts            # Calculator + current-time tools
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Progress tracker

- [x] Day 1 — Streaming chatbot with tool calling ✅ shipped
- [ ] Day 2 — Structured outputs (Zod schemas + `generateObject`)
- [ ] Day 3 — Embeddings & semantic search
- [ ] Day 4 — RAG v1 (in-memory)
- [ ] Day 5 — RAG v2 (`pgvector` + reranking)
- [ ] Day 6 — Agents with multi-tool use
- [ ] Day 7 — Deploy a web service (Next.js or Hono)
- [ ] Day 8 — Evals (`Braintrust` / `vitest`)
- [ ] Day 9 — Observability (`Langfuse` / `Helicone`)
- [ ] Day 10 — Vector DB deep-dive + Python intro
- [ ] Day 11 — Local models with `Ollama` / `vLLM`
- [ ] Day 12 — Fine-tuning with LoRA
- [ ] Day 13 — Capstone project (build)
- [ ] Day 14 — Capstone polish + blog post

---

## Ground rules

1. Ship something every day. Working code beats perfect notes.
2. Push to GitHub daily so you have a public trail of progress.
3. When stuck for >30 minutes, ask the AI assistant or post on X. Don't grind alone.
4. After Day 14, do NOT claim to be a "Senior AI Engineer." Claim to be "an experienced engineer who shipped 14 AI projects in 14 days." That's honest and impressive.
# AIML
