"""
============================================================================
 SECTION 15  —  HELLO LLM IN PYTHON  (streaming chat, no tools, no memory)
 main.py
============================================================================

 ROLE
   The "is the environment alive?" test from `docs/python-for-nodejs-engineers.md`
   §15. Sends a single chat message to a Groq-hosted Llama 3.3 70B model
   over Groq's OpenAI-compatible HTTP endpoint and streams the tokens to
   stdout as they arrive.

   This is NOT a full port of the TypeScript Stage 5 agent — there are no
   tools, no multi-turn history, no readline loop. It is the smallest
   possible thing that proves four facts at once:
     1. `uv` resolved + installed Python 3.13 and the deps cleanly.
     2. `python-dotenv` reads `.env` into `os.environ` the same way
        Node's `dotenv` populates `process.env`.
     3. The OpenAI Python SDK can be pointed at a non-OpenAI endpoint
        (Groq) via `base_url=` — exactly the same provider-abstraction
        trick we use in `src/lib/llm.ts`.
     4. Server-sent-event streaming works end-to-end (token-by-token
        rendering), which is what makes any production chat UI feel fast.

 THE TS  →  PYTHON MAP (concept by concept, what changed vs Stage 5)

   ┌────────────────────────────────────────┬─────────────────────────────────────────┐
   │ TypeScript (AIML/src/day-01-chatbot)   │ Python (this file)                      │
   ├────────────────────────────────────────┼─────────────────────────────────────────┤
   │ import "dotenv/config";                │ from dotenv import load_dotenv          │
   │                                        │ load_dotenv()                            │
   │                                        │   ─ Node auto-loads on import;          │
   │                                        │     Python requires an explicit call.   │
   ├────────────────────────────────────────┼─────────────────────────────────────────┤
   │ process.env.GROQ_API_KEY               │ os.environ.get("GROQ_API_KEY")          │
   │   ─ string | undefined                 │   ─ str | None  (use `.get` for None,   │
   │                                        │     `os.environ["..."]` to raise        │
   │                                        │     KeyError on missing.)               │
   ├────────────────────────────────────────┼─────────────────────────────────────────┤
   │ Vercel AI SDK `streamText({...})`      │ OpenAI SDK                              │
   │   provider-agnostic via @ai-sdk/groq   │   client.chat.completions.create(       │
   │                                        │     stream=True, ...)                   │
   │                                        │   provider-agnostic via base_url=       │
   ├────────────────────────────────────────┼─────────────────────────────────────────┤
   │ for await (const chunk of result.     │ for chunk in response:                  │
   │   fullStream) { ... }                  │   ─ The OpenAI Python SDK exposes a     │
   │                                        │     SYNCHRONOUS iterator over the SSE   │
   │                                        │     stream. There is also an async      │
   │                                        │     variant (AsyncOpenAI) — we use sync │
   │                                        │     here because main() is sync.        │
   ├────────────────────────────────────────┼─────────────────────────────────────────┤
   │ chunk.textDelta  (string)              │ chunk.choices[0].delta.content          │
   │                                        │   ─ str | None  (None signals "no text  │
   │                                        │     in this chunk, just metadata", e.g. │
   │                                        │     role/finish_reason events). Coalesce│
   │                                        │     with `or ""` to render safely.      │
   ├────────────────────────────────────────┼─────────────────────────────────────────┤
   │ output.write(part.textDelta);          │ print(delta, end="", flush=True)        │
   │                                        │   ─ `end=""`     ─ suppress the default │
   │                                        │                    "\n" so tokens       │
   │                                        │                    concatenate on one   │
   │                                        │                    visual line.         │
   │                                        │   ─ `flush=True` ─ defeats Python's     │
   │                                        │                    line-buffered stdout │
   │                                        │                    so the user actually │
   │                                        │                    SEES tokens stream.  │
   │                                        │                    Without it the whole │
   │                                        │                    response appears at  │
   │                                        │                    once at the end.     │
   └────────────────────────────────────────┴─────────────────────────────────────────┘

 EXECUTION FLOW

   ┌──────────────────────────────────────────────────────────────────┐
   │ 1.  load_dotenv()                                                 │
   │       reads `.env` into `os.environ`                              │
   │       ↓                                                            │
   │ 2.  os.environ.get("GROQ_API_KEY")                                │
   │       fail-fast if missing (same pattern as src/config/env.ts)    │
   │       ↓                                                            │
   │ 3.  OpenAI(api_key=..., base_url="https://api.groq.com/openai/v1")│
   │       provider abstraction — point the OpenAI client at Groq's    │
   │       OpenAI-compatible endpoint. Same trick works for any        │
   │       OpenAI-compatible host (Together AI, OpenRouter, vLLM,      │
   │       Ollama on 11434, llama.cpp's server, etc.).                 │
   │       ↓                                                            │
   │ 4.  client.chat.completions.create(stream=True, ...)              │
   │       returns a Stream[ChatCompletionChunk] — an iterator over    │
   │       SSE chunks. Network request is made eagerly; chunks arrive  │
   │       as the model generates them.                                │
   │       ↓                                                            │
   │ 5.  for chunk in response:                                        │
   │       pull the `delta.content` (a str | None) off each chunk and  │
   │       print it without a newline, flushing stdout each time.      │
   │       ↓                                                            │
   │ 6.  print()                                                       │
   │       trailing newline so the next shell prompt isn't glued to    │
   │       the last token.                                             │
   └──────────────────────────────────────────────────────────────────┘

 AI/ML SKILLS THIS BUILDS
   - Provider abstraction via OpenAI-compatible endpoints. This pattern
     (one SDK, many `base_url`s) is how production teams swap models
     without rewriting application code. It's the Python mirror of the
     `getModel()` factory in `src/lib/llm.ts`.
   - Streaming UX. The `flush=True` detail is *the* difference between
     "feels like ChatGPT" and "feels like batch". Every chat UI you've
     ever liked is doing exactly this.
   - Fail-fast configuration. Crashing at startup when `GROQ_API_KEY`
     is missing — instead of crashing on the first model call — is the
     same "Zod-validate-env-on-boot" pattern from `src/config/env.ts`.
   - The Pydantic-shaped response object. `chunk.choices[0].delta.content`
     is dotted access on Pydantic models, not dict access. This is what
     replaces the AI SDK's TypeScript interfaces — same DX, runtime-
     validated.

 PRODUCTION ANALOG
   Replace `stream=True` + the `for` loop with FastAPI's StreamingResponse
   and you have the backbone of a production streaming chat endpoint.
   The provider-abstraction (`base_url=`) is what lets you ship one app
   that runs on OpenAI in prod, Groq in dev, Ollama in CI, and a local
   vLLM server when GPUs are free.

 WHAT THIS DELIBERATELY DOES NOT DO
   - No multi-turn memory.   See Stage 5 (TS) for how `history: list[dict]`
     becomes the only memory the model has across turns.
   - No tool calling.        See Stage 4 (TS) tools.ts. Python equivalent
                             is `instructor` or raw `tools=[...]` kwarg.
   - No structured output.   See Stage 6 (TS) extractors. Python
                             equivalent is `instructor.from_openai(...)`
                             + Pydantic `response_model=`.
   - No retries / timeouts.  Production code MUST add both (the OpenAI
                             SDK has built-in retry config; we'll wire
                             it up properly when we port the chatbot).
============================================================================
"""

import os
import sys

from dotenv import load_dotenv
from openai import OpenAI


def main() -> None:
    # ------------------------------------------------------------------
    # 1.  ENV LOADING
    #
    # `load_dotenv()` walks up from CWD looking for a `.env`, then merges
    # its KEY=VALUE pairs into `os.environ` (does NOT overwrite values
    # already present in the real environment — the real env wins).
    #
    # Difference from Node: in TS we wrote `import "dotenv/config"` which
    # ran the side effect on module import. Python deliberately makes you
    # call the function — Python's culture frowns on import-time side
    # effects, because it makes test isolation and import order matter.
    # ------------------------------------------------------------------
    load_dotenv()

    # ------------------------------------------------------------------
    # 2.  FAIL-FAST CONFIG CHECK
    #
    # Mirror of the Zod-on-startup pattern in `src/config/env.ts`. We
    # crash NOW (before constructing the client, before making any HTTP
    # calls) if the key is missing, so the error message is unambiguous.
    #
    # `os.environ.get("X")` returns `str | None`. The alternative,
    # `os.environ["X"]`, raises `KeyError` — useful when you'd rather
    # let it propagate, but a custom message is friendlier for a tutorial
    # script. `sys.exit(message)` prints `message` to stderr and exits 1.
    # ------------------------------------------------------------------
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        sys.exit(
            "GROQ_API_KEY is not set. Paste your key into .env "
            "(get one free at https://console.groq.com/keys)."
        )

    # ------------------------------------------------------------------
    # 3.  PROVIDER ABSTRACTION  (OpenAI client → Groq backend)
    #
    # Groq exposes an OpenAI-compatible HTTP API at
    #   https://api.groq.com/openai/v1
    # so the official `openai` Python SDK works unchanged — we just
    # repoint `base_url`. The wire format (request/response shapes) is
    # 100% OpenAI's; Groq's only differences are the model names and
    # the fact that inference is ~10x faster.
    #
    # The same trick lets one codebase target:
    #   - OpenAI:      base_url = (omit; default)
    #   - Together AI: base_url = "https://api.together.xyz/v1"
    #   - OpenRouter:  base_url = "https://openrouter.ai/api/v1"
    #   - Ollama:      base_url = "http://localhost:11434/v1"
    #   - vLLM/local:  base_url = "http://localhost:8000/v1"
    # This is the Python mirror of the `getModel()` factory in
    # `src/lib/llm.ts` (which uses `@ai-sdk/openai`/`@ai-sdk/groq`/etc.).
    # ------------------------------------------------------------------
    client = OpenAI(
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1",
    )

    # ------------------------------------------------------------------
    # 4.  THE STREAMING CALL
    #
    # `chat.completions.create(...)` is the single most important call
    # in the entire OpenAI SDK. Three things to notice:
    #
    #   - `model="llama-3.3-70b-versatile"` — a *string identifier*,
    #     not an SDK-specific object. Provider portability comes from
    #     swapping this string + `base_url` together.
    #
    #   - `messages=[...]` — a list of dicts with `role` + `content`.
    #     Roles: "system" (policy), "user" (the human), "assistant"
    #     (past model output, when doing multi-turn), "tool" (tool
    #     results). For this single-shot call we only need system+user.
    #
    #   - `stream=True` — flips the return type from a single
    #     `ChatCompletion` to an iterable `Stream[ChatCompletionChunk]`.
    #     Under the hood the SDK opens an SSE connection and yields
    #     chunks as the network delivers them.
    #
    # Note the kwarg-style call. Python doesn't have an "options object"
    # convention — named kwargs ARE the options. Equivalent JS would be
    # one object literal: `create({ model, messages, stream: true })`.
    # ------------------------------------------------------------------
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are concise and technical."},
            {"role": "user", "content": "Explain embeddings in one sentence."},
        ],
        stream=True,
    )

    # ------------------------------------------------------------------
    # 5.  THE STREAM-RENDER LOOP
    #
    # Each `chunk` is a Pydantic model (`ChatCompletionChunk`) shaped
    # roughly like:
    #
    #   ChatCompletionChunk(
    #     id="...",
    #     choices=[
    #       Choice(
    #         delta=ChoiceDelta(
    #           role="assistant" | None,
    #           content="some text" | None,   # ← what we want
    #         ),
    #         finish_reason="stop" | None,
    #       )
    #     ],
    #     ...
    #   )
    #
    # `delta.content` is `str | None` because some chunks carry only
    # metadata (the very first chunk announces `role="assistant"` with
    # no text; the last carries `finish_reason="stop"` with no text).
    #
    # `delta.content or ""` is Python's idiomatic null-coalesce:
    #   - In TS:     `delta.content ?? ""`
    #   - In Python: `delta.content or ""`
    # Subtle difference: `or` also coalesces empty string, 0, [], {}, etc.
    # to the fallback — not just None. For LLM streaming chunks that's
    # exactly what we want; in other contexts (e.g. numeric fallbacks)
    # the difference matters and you'd reach for an explicit
    # `delta.content if delta.content is not None else ""`.
    #
    # `print(delta, end="", flush=True)`:
    #   - `end=""`     — Python's `print` appends "\n" by default; we
    #                    suppress that so tokens concatenate naturally.
    #   - `flush=True` — stdout in non-TTY contexts is line-buffered,
    #                    so without this the OS would hold the whole
    #                    response in a buffer and dump it at the end,
    #                    defeating the entire point of streaming. The
    #                    JS equivalent (`process.stdout.write`) flushes
    #                    by default; Python does not. This single flag
    #                    is the #1 footgun for "why doesn't my Python
    #                    stream feel like streaming?"
    # ------------------------------------------------------------------
    for chunk in response:
        delta = chunk.choices[0].delta.content or ""
        print(delta, end="", flush=True)

    # ------------------------------------------------------------------
    # 6.  TRAILING NEWLINE
    #
    # The loop never emitted "\n", so without this the user's next
    # shell prompt would be jammed against the final token. Tiny UX
    # detail; matters every time.
    # ------------------------------------------------------------------
    print()


# ----------------------------------------------------------------------
# PYTHON ENTRY POINT IDIOM
#
# This guard is the Python equivalent of `void main()` at the bottom of
# the TS file. Why the guard? Because Python files can be IMPORTED as
# modules (e.g. `from main import main`) AND executed as scripts. The
# `__name__` variable equals:
#   - "__main__"  when the file is run directly (`uv run python main.py`)
#   - "main"      when the file is imported from elsewhere
# Wrapping the call in this guard means importing the module does NOT
# fire the LLM call as a side effect. It's the same "explicit > implicit"
# rule that made us call `load_dotenv()` manually instead of via import.
# ----------------------------------------------------------------------
if __name__ == "__main__":
    main()
