# AI Engineering Sprint — 14 Days (Python edition)

A focused, ship-something-daily sprint to go from "experienced Node.js/DevOps engineer" to "dangerous AI Engineer." Built in **Python** with `uv`, `openai`, `pydantic`, and friends — the standard stack for production AI work.

> Full curriculum: [`docs/curriculum.md`](docs/curriculum.md)
> Python crash course for JS engineers: [`docs/python-for-nodejs-engineers.md`](docs/python-for-nodejs-engineers.md)

---

## Repo history

This repo started in TypeScript (Days 1–2 shipped on the `typescript-final` branch as a permanent archive) and pivoted to Python at the start of Day 3 because the AI/ML ecosystem from Stage 12 onward (local models, fine-tuning, Hugging Face, `vLLM`, classical ML) is Python-only. The mental models from the TS work transfer directly — only the syntax changed.

- **TS archive:** [`typescript-final` branch](https://github.com/amit-surwar/AIML/tree/typescript-final) — Day 1 (streaming chatbot + tool calling) and Day 2 (structured outputs, 3 extractors) in TypeScript.
- **Main (this branch):** the Python sprint going forward.

---

## Prerequisites

- macOS / Linux (Windows works via WSL2)
- A free API key from Groq or Google (no credit card required)
- 4–6 focused hours per day for 14 days

---

## Setup

Install `uv` (Astral's modern, fast Python package manager — the closest thing to `bun` for Python):

```bash
# macOS via Homebrew
brew install uv

# or universal installer
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Then clone and sync dependencies:

```bash
git clone https://github.com/amit-surwar/AIML.git
cd AIML
uv sync                  # creates .venv/ and installs deps (Python 3.13 auto-downloaded if missing)
cp .env.example .env     # then open .env and paste your GROQ_API_KEY
```

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

## Day 1 — Hello LLM (streaming chat warmup)

The smallest possible script that proves your Python AI dev environment is alive: streams a single chat completion from Groq's OpenAI-compatible endpoint and prints tokens as they arrive.

```bash
uv run python src/day_01_hello_llm/main.py
```

Expected output (something like):

```
Embeddings are dense vector representations of high-dimensional data, such as words or images, that capture semantic relationships and patterns in a lower-dimensional space.
```

### What you'll learn on Day 1

- Provider abstraction via `base_url=` — point the OpenAI SDK at Groq, Together AI, Ollama, vLLM, etc. with a one-line change
- Streaming responses with the OpenAI Python SDK (the SSE iterator pattern)
- The `flush=True` detail that makes terminal streaming actually feel like streaming
- The `os.environ.get(...) → sys.exit()` fail-fast pattern (Python mirror of Zod-on-startup)
- Why `delta.content or ""` is the idiomatic null-coalesce in Python (and where it differs from `??`)

The file (`src/day_01_hello_llm/main.py`) is **heavily annotated** — read it top to bottom. It's a tutorial, not a script.

---

## Project layout

```
.
├── docs/
│   ├── curriculum.md                    # 14-day plan (language-agnostic)
│   └── python-for-nodejs-engineers.md   # Python crash course for JS engineers
├── src/
│   ├── __init__.py
│   └── day_01_hello_llm/
│       ├── __init__.py
│       └── main.py                      # Streaming hello-LLM (annotated)
├── .env.example
├── .python-version
├── pyproject.toml
└── uv.lock
```

---

## Progress tracker

### TypeScript prologue (preserved on `typescript-final` branch)

- [x] Day 1 (TS) — Streaming chatbot with tool calling — shipped
- [x] Day 2 (TS) — Structured outputs (3 extractors) — shipped

### Python sprint (main branch)

- [x] Day 1 — Hello LLM (Section 15 warmup, env validated)
- [ ] Day 2 — Full chatbot port: tools (calculator + current-time), multi-turn memory, streaming with `for chunk in stream`
- [ ] Day 3 — Embeddings & semantic search (`openai.embeddings.create` + numpy cosine)
- [ ] Day 4 — RAG v1 (in-memory)
- [ ] Day 5 — RAG v2 (`pgvector` + reranking with Cohere)
- [ ] Day 6 — Agents with multi-tool use (`instructor` or raw `tools=[...]`)
- [ ] Day 7 — Deploy a web service (FastAPI + Uvicorn)
- [ ] Day 8 — Evals (`pytest` or `Braintrust`)
- [ ] Day 9 — Observability (`Langfuse` / `Helicone`)
- [ ] Day 10 — Vector DB deep-dive (`qdrant-client` / `chromadb`)
- [ ] Day 11 — Local models with `Ollama` / `vLLM`
- [ ] Day 12 — Fine-tuning with LoRA (Hugging Face `trl`)
- [ ] Day 13 — Capstone project (build)
- [ ] Day 14 — Capstone polish + blog post

---

## Ground rules

1. Ship something every day. Working code beats perfect notes.
2. Push to GitHub daily so you have a public trail of progress.
3. When stuck for >30 minutes, ask the AI assistant or post on X. Don't grind alone.
4. After Day 14, do NOT claim to be a "Senior AI Engineer." Claim to be "an experienced engineer who shipped 14 AI projects in 14 days." That's honest and impressive.

---

## Toolchain reference (Python equivalents of your Node/TS tools)

| Node.js / TS | Python | Used here |
|---|---|---|
| `npm` / `pnpm` / `bun` | `uv` | ✅ |
| `package.json` | `pyproject.toml` | ✅ |
| `package-lock.json` | `uv.lock` | ✅ |
| `node_modules/` | `.venv/` | ✅ (gitignored) |
| `dotenv` | `python-dotenv` | ✅ |
| Vercel AI SDK | `openai` (+ `instructor` for structured outputs) | ✅ |
| `zod` | `pydantic` | (arrives in Day 2) |
| `eslint` + `prettier` | `ruff` | configured in `pyproject.toml` |
| `tsc` | `pyright` | configured in `pyproject.toml` |
| `vitest` / `jest` | `pytest` | (arrives in Day 8) |
| `express` / `hono` | `fastapi` | (arrives in Day 7) |
