# 14-Day AI Engineering Sprint — Curriculum

> Realistic goal: become **dangerous enough to ship LLM apps** and speak the language of AI Engineering.
> Not realistic: "learn all of AI/ML." That takes 12+ months.

Time budget: **4–6 focused hours/day**. Aim for 60–80 hours total over 2 weeks.

Rule: ship something every single day. No tutorial hell.

---

## Week 1 — Build LLM apps end-to-end (TypeScript-first)

You already know Node.js. Week 1 is in TypeScript so you can move fast.

### Day 1 — Streaming chatbot with tool calling  ✅ scaffolded

- Concepts: tokens, context window, temperature, top-p, system prompts, streaming, tool calling
- Run: `npm run day-01`
- Output: working CLI chatbot with calculator + time tools
- Read: [Vercel AI SDK docs](https://sdk.vercel.ai/docs) (1 hr skim)
- Watch: [Karpathy — Intro to LLMs (1 hr)](https://www.youtube.com/watch?v=zjkBMFhNj_g)

### Day 2 — Structured outputs & function calling

- Concepts: JSON mode, schema-constrained generation, function/tool calling patterns
- Build: a "form filler" that extracts structured data from messy free text using Zod schemas
- Read: [OpenAI Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs)
- Stretch: add `generateObject` from the AI SDK

### Day 3 — Embeddings & semantic search

- Concepts: embeddings, cosine similarity, vector spaces, chunking
- Build: a semantic search CLI over 50–100 of your own markdown notes / blog posts
- Stack: `@ai-sdk/openai` embedding model + in-memory cosine search (no DB yet)
- Read: [Simon Willison — Embeddings](https://simonwillison.net/2023/Oct/23/embeddings/)

### Day 4 — RAG v1 (in-memory)

- Concepts: chunking strategies, retrieval, top-k, prompt assembly with context
- Build: ask questions over a folder of PDFs/markdown — answers must cite sources
- Stack: same embedding model + simple text splitter + your Day 1 chatbot

### Day 5 — RAG v2 (vector DB + reranking)

- Concepts: vector DB tradeoffs, hybrid search (BM25 + vector), reranking
- Build: migrate Day 4 to `pgvector` (Postgres) or `Qdrant` (Docker)
- Add: a cross-encoder reranker (Cohere Rerank API or local model)

### Day 6 — Agents & tool use

- Concepts: ReAct loop, multi-step reasoning, tool design, `maxSteps`
- Build: a research agent — web search (Tavily/Exa) + URL fetcher + summarizer
- Stack: AI SDK `streamText` with `maxSteps: 10` and multiple tools

### Day 7 — Deploy & polish

- Build: turn your best app into a deployed web service
- Stack: Next.js or Hono + Vercel/Cloudflare (your DevOps skills shine here)
- Add: rate limiting, basic auth, error handling, streaming UI

---

## Week 2 — Production-aware AI Engineering

This is where your 8 years of experience compound. Most "AI Engineers" can't do this part.

### Day 8 — Evals

- Concepts: golden datasets, LLM-as-judge, regression testing for prompts
- Build: 20+ test cases for your RAG app, automated eval script
- Tools: `Braintrust`, `Langfuse`, or roll your own with `vitest`

### Day 9 — Observability & cost control

- Concepts: tracing, prompt caching, semantic caching, model routing
- Add: `Langfuse` or `Helicone` to every LLM call in your apps
- Measure: p50/p95 latency, cost per request, cache hit rate

### Day 10 — Vector DB deep-dive + Python intro

- Concepts: HNSW, IVF, quantization, hybrid search internals
- Switch: start using Python for this day (it's where most ML/data tools live)
- Tools: `uv` for Python, `qdrant-client`, `psycopg` + `pgvector`

### Day 11 — Run open-source models locally

- Concepts: quantization (4/8-bit), GGUF, context length tradeoffs
- Build: run Llama 3.3, Qwen 2.5, or DeepSeek locally with `Ollama`
- Stretch: serve with `vLLM` and benchmark vs. API

### Day 12 — Fine-tuning fundamentals

- Concepts: when fine-tuning helps (rarely!), LoRA, QLoRA, DPO
- Build: fine-tune a small model on a domain dataset using Hugging Face `trl` + LoRA
- Alternative: use OpenAI or Together AI's hosted fine-tuning (faster, no GPU)

### Day 13 — Capstone (day 1 of 2)

- Build a portfolio project combining: agents + RAG + evals + observability + deployment
- Suggested ideas:
  - "AI on-call engineer" — agent that searches logs, runs queries, summarizes incidents
  - "Code review bot" for a GitHub repo
  - "Docs concierge" for a real OSS project (use their docs as the RAG corpus)

### Day 14 — Ship & write

- Finish capstone
- Write a 1000-word blog post: what you built, what you learned, what you got wrong
- Push to GitHub with a clean README
- Post on X/LinkedIn

---

## Honest expectations after Day 14

You will know:
- How to ship production-quality LLM apps
- The full AI Engineer vocabulary
- Enough to pass a screening interview at most AI-first startups

You will NOT know:
- How transformers work internally
- Classical ML (regression, trees, clustering)
- How to train models from scratch
- Most academic ML research

That's fine. Those are months 2–6. This sprint is about getting in the game.
