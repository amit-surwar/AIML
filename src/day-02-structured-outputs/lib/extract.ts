/**
 * ============================================================================
 *  STAGE 6  —  EXTRACTION ENGINE (reusable "text → typed object" pipeline)
 *  src/day-02-structured-outputs/lib/extract.ts
 * ============================================================================
 *
 *  ROLE
 *    The reusable "LLM → typed object" pipeline. Every extractor in
 *    src/day-02-structured-outputs/extractors/* uses this engine.
 *
 *  WHY IT EXISTS
 *    Without this file, each extractor would duplicate ~30 lines of
 *    boilerplate: call generateObject, catch errors, log token usage,
 *    return a typed result. Centralizing it means a new extractor is just
 *    a schema + two prompts (≈30 lines total).
 *
 *  AI/ML SKILL THIS TEACHES
 *    - "Schema-constrained generation" — making an LLM physically unable
 *      to return invalid shape. The single most important pattern in
 *      production AI Engineering.
 *    - The Result type pattern for AI calls (LLM calls fail often;
 *      throwing exceptions everywhere is bad UX for callers).
 *    - The difference between single-shot (generateObject) and streaming
 *      (streamObject) extraction, and when each is appropriate.
 *
 *  HOW IT CONNECTS
 *    - Consumed by every file in ../extractors/*.ts (they only define
 *      schemas + prompts; this file actually calls the model).
 *    - Called by ../index.ts (the CLI) once per extraction request.
 *    - Uses @/lib/llm to get a provider-agnostic model handle (Groq,
 *      Google, OpenAI, Anthropic — chosen via env var).
 * ============================================================================
 */

import { generateObject, streamObject, type LanguageModelV1 } from "ai";
import type { z } from "zod";
import { logger } from "@/lib/logger";

/**
 * Contract every extractor must satisfy.
 *
 * Generic over the Zod schema (TSchema) so we get end-to-end type safety:
 * if an extractor uses schema X, then runExtractor(..., that extractor, ...)
 * returns data typed as z.infer<typeof X>. No `any`, no manual casts.
 *
 * - schema       : the structural contract (output MUST match this shape)
 * - systemPrompt : sets the role / global policy / judgment rules
 * - buildPrompt  : wraps the raw input (fenced with delimiters to resist
 *                  prompt injection from user-supplied text)
 * - sampleInput  : built-in test fixture so the CLI can run with --sample
 */
export type ExtractorDefinition<TSchema extends z.ZodTypeAny> = {
  name: string;
  description: string;
  schema: TSchema;
  systemPrompt: string;
  buildPrompt: (input: string) => string;
  sampleInput?: string;
};

/**
 * Discriminated union result type.
 *
 * Why not just throw on failure? Because LLM calls fail FREQUENTLY in
 * production — rate limits, network errors, schema validation failures,
 * model refusals. Forcing the caller to handle { ok: false } explicitly
 * is far safer than try/catch sprinkled everywhere. This is the same
 * pattern Rust uses for Result<T, E>, and the same pattern adopted by
 * libraries like neverthrow in TypeScript.
 */
export type ExtractResult<TSchema extends z.ZodTypeAny> = {
  ok: true;
  data: z.infer<TSchema>;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
} | {
  ok: false;
  error: string;
};

/**
 * runExtractor — single-shot extraction.
 *
 * Use when:
 *   - You need the full validated object before doing anything.
 *   - The output is small (1 KB or so).
 *   - You're in a backend pipeline (no UI to show partial progress).
 *
 * Trade-off vs streamExtractor: simpler API, but the user waits in
 * silence until the entire object is generated.
 */
export const runExtractor = async <TSchema extends z.ZodTypeAny>(
  model: LanguageModelV1,
  extractor: ExtractorDefinition<TSchema>,
  input: string,
): Promise<ExtractResult<TSchema>> => {
  try {
    const result = await generateObject({
      model,
      schema: extractor.schema,
      system: extractor.systemPrompt,
      prompt: extractor.buildPrompt(input),
      /*
       * mode controls HOW the SDK constrains the model:
       *   "tool" → model returns a tool call with the structured args.
       *            Works on every model that supports tool calling,
       *            including open models like Llama 3.3 on Groq.
       *   "json" → uses native JSON mode. Faster on OpenAI/Gemini, but
       *            not all open models support it reliably.
       *   "auto" → SDK picks. Less predictable.
       * We pick "tool" because it's the most portable and we're often
       * targeting Llama via Groq in this sprint.
       */
      mode: "tool",
    });

    logger.debug("extractor complete", {
      extractor: extractor.name,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
    });

    return {
      ok: true,
      data: result.object,
      usage: {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
    };
  } catch (error) {
    /*
     * Common failure modes here in production:
     *   - 429 rate limit (we should back off and retry)
     *   - schema validation failure (model returned malformed args;
     *     the SDK already retried internally; if it still failed, the
     *     schema may be too strict — relax minimums or add nullables)
     *   - 401 invalid API key (the user forgot to rotate / paste)
     *   - 400 context length exceeded (input too big; need chunking → Day 4)
     */
    const message = error instanceof Error ? error.message : String(error);
    logger.error("extractor failed", { extractor: extractor.name, error: message });
    return { ok: false, error: message };
  }
};

/**
 * Event emitted by streamExtractor as the object is being generated.
 *
 *   partial — the object so far (some fields may still be missing).
 *   final   — the fully-validated final object (only emitted once, at end).
 *   error   — extraction failed entirely.
 *
 * Why three event types instead of just yielding the object?
 * Callers (like the CLI) want to differentiate "still building" from
 * "done" — typically by clearing the screen and re-rendering on each
 * partial, then printing a "DONE" banner on final.
 */
export type StreamExtractEvent<TSchema extends z.ZodTypeAny> =
  | { type: "partial"; data: Partial<z.infer<TSchema>> }
  | { type: "final"; data: z.infer<TSchema> }
  | { type: "error"; error: string };

/**
 * streamExtractor — progressive extraction (streamObject under the hood).
 *
 * Use when:
 *   - You have a UI and want to show "building..." feedback.
 *   - The object is large enough that the user would otherwise wait
 *     several seconds in silence.
 *
 * Implementation note:
 *   Implemented as an async generator (note the `function*`). The CLI
 *   consumes it with `for await (const event of streamExtractor(...))`.
 *   This is the same pattern ChatGPT, Cursor, Claude.ai etc. use to
 *   stream UI updates — but for typed objects instead of free text.
 */
export const streamExtractor = async function* <TSchema extends z.ZodTypeAny>(
  model: LanguageModelV1,
  extractor: ExtractorDefinition<TSchema>,
  input: string,
): AsyncGenerator<StreamExtractEvent<TSchema>, void, unknown> {
  try {
    const result = streamObject({
      model,
      schema: extractor.schema,
      system: extractor.systemPrompt,
      prompt: extractor.buildPrompt(input),
      mode: "tool",
    });

    /*
     * partialObjectStream yields the object after each new field arrives.
     * Early partials look like {} or { summary: "..." }; later ones fill in.
     * Cast is needed because the SDK types it more loosely than our generic.
     */
    for await (const partial of result.partialObjectStream) {
      yield { type: "partial", data: partial as Partial<z.infer<TSchema>> };
    }

    /*
     * Await the final, fully-validated object. This is the only point
     * where Zod validation actually runs end-to-end. Partials are NOT
     * validated (they're often incomplete by design).
     */
    const final = await result.object;
    yield { type: "final", data: final };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("stream extractor failed", { extractor: extractor.name, error: message });
    yield { type: "error", error: message };
  }
};
