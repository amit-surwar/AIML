/**
 * ============================================================================
 *  STAGE 1  —  ENVIRONMENT CONFIG  (the first thing that runs)
 *  src/config/env.ts
 * ============================================================================
 *
 *  ROLE
 *    Loads .env, validates every variable, and exposes a typed `env`
 *    object. NOTHING in the codebase reads process.env directly — they
 *    all read this `env` constant instead.
 *
 *  WHY THIS IS THE *FIRST* MODULE TO RUN
 *    Importing this file has a side effect: it parses process.env and
 *    throws immediately if anything is invalid. By placing it at the top
 *    of every entry point's import graph, the process either:
 *      (a) starts cleanly with a fully-validated environment, OR
 *      (b) crashes in the first ~50ms with an exact error message.
 *    There is no third state where "config is half-loaded." This is
 *    called "fail-fast configuration" and is a non-negotiable pattern
 *    in any production system, AI or not.
 *
 *  WHY ZOD INSTEAD OF process.env.X
 *    process.env values are ALWAYS string | undefined. Without
 *    validation, a typo in your .env name will only surface as a
 *    confusing runtime error 30 minutes into a job. Zod catches it
 *    at startup and gives you a real error.
 *
 *  AI/ML SKILLS THIS BUILDS
 *    - Provider-agnostic configuration. The same code base works with
 *      Groq, Google Gemini, OpenAI, or Anthropic — chosen by a single
 *      env var. This is how production AI systems handle vendor risk:
 *      they don't hardcode the model choice into the code.
 *    - Secret hygiene at the boundary. Real keys are loaded once, in
 *      one place, validated, then passed by reference. No raw secrets
 *      ever flow through business logic.
 * ============================================================================
 */

import "dotenv/config";
import { z } from "zod";

/*
 * Provider → env-var-name map. Adding a new provider means adding it
 * here AND in the LLM_PROVIDER enum below. Keeping the map separate
 * from the schema lets the refinement (further down) reference it
 * dynamically — "for the chosen provider, its key must be set."
 */
const PROVIDER_KEY_MAP = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
} as const;

/*
 * Empty-string coercion. The most common .env mistake:
 *     OPENAI_API_KEY=
 * This isn't "unset" in Node's eyes — it's the empty string "". A
 * naive z.string().min(1).optional() FAILS for "". The transform
 * below converts "" → undefined so it behaves like "unset", and the
 * provider-specific check below only enforces non-empty for the key
 * tied to the currently selected LLM_PROVIDER.
 */
const optionalKey = z
  .string()
  .optional()
  .transform((value): string | undefined =>
    value === undefined || value.trim() === "" ? undefined : value,
  );

const envSchema = z
  .object({
    OPENAI_API_KEY: optionalKey,
    ANTHROPIC_API_KEY: optionalKey,
    GROQ_API_KEY: optionalKey,
    GOOGLE_GENERATIVE_AI_API_KEY: optionalKey,
    /*
     * LLM_PROVIDER is the single switch that picks which model service
     * the rest of the code talks to. Default = groq because Groq's free
     * tier has the highest request limits and the fastest inference at
     * this stage of the project.
     */
    LLM_PROVIDER: z
      .enum(["openai", "anthropic", "groq", "google"])
      .default("groq"),
    LLM_MODEL: z.string().min(1).default("llama-3.3-70b-versatile"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  /*
   * Cross-field refinement: "the key for the chosen provider must be set."
   * Each provider has its own env-var name; we look it up dynamically
   * from PROVIDER_KEY_MAP rather than writing four if-branches.
   */
  .refine(
    (data): boolean => Boolean(data[PROVIDER_KEY_MAP[data.LLM_PROVIDER]]),
    (data) => ({
      message: `Missing ${PROVIDER_KEY_MAP[data.LLM_PROVIDER]} in .env for LLM_PROVIDER="${data.LLM_PROVIDER}"`,
    }),
  );

/*
 * Inferred type — used by every consumer of `env`. Means autocomplete
 * works on env.LLM_PROVIDER, env.GROQ_API_KEY, etc. and a typo like
 * env.GROK_API_KEY is a compile error.
 */
export type Env = z.infer<typeof envSchema>;

/*
 * loadEnv runs at module import time (see the `env` constant below).
 * If validation fails we throw immediately — the rest of the app never
 * gets a chance to run with a broken config.
 */
const loadEnv = (): Env => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
};

/*
 * The ONLY thing the rest of the codebase imports from this file.
 * Top-level execution = fail-fast. If you see this throwing, you have
 * 5 seconds to fix it before any other code runs.
 */
export const env: Env = loadEnv();
