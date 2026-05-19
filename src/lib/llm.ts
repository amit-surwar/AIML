/**
 * ============================================================================
 *  STAGE 3  —  PROVIDER ABSTRACTION
 *  src/lib/llm.ts
 * ============================================================================
 *
 *  ROLE
 *    Returns a single, provider-agnostic `LanguageModelV1` handle that
 *    every higher-level feature (chat, extraction, embeddings, agents)
 *    uses without knowing which company built the model behind it.
 *
 *  THE KEY MENTAL MODEL
 *    The Vercel AI SDK defines a common interface (LanguageModelV1).
 *    Each provider (OpenAI, Anthropic, Groq, Google) ships an adapter
 *    that turns its proprietary HTTP API into this interface. Our code
 *    only ever talks to the interface — never to the proprietary APIs
 *    directly. Swap providers by changing ONE env variable.
 *
 *  WHY THIS PATTERN IS A BIG DEAL IN AI ENGINEERING
 *    Models change weekly. Pricing changes weekly. Rate limits change
 *    daily. Real production systems often:
 *      - Route easy/cheap traffic to a small model (e.g. Llama 8B)
 *      - Route hard/expensive traffic to a frontier model (e.g. GPT-4o)
 *      - Fall back to a backup provider when the primary 503s
 *    All of this is impossible if your code is coupled to one provider's
 *    SDK. The factory below is the first step toward that capability.
 *
 *  AI/ML SKILLS THIS BUILDS
 *    - Vendor risk management (one of the top concerns in real AI orgs).
 *    - The Strategy pattern applied to LLM clients.
 *    - Understanding that "the model" is a swappable component, not a
 *      hardcoded dependency.
 * ============================================================================
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";
import { env } from "@/config/env";

/*
 * Factory function. Reads env.LLM_PROVIDER (validated upstream by Zod)
 * and returns the correctly-configured client.
 *
 * Important: even though env is already validated at startup, we
 * defensively re-check the specific key inside each branch. Why?
 *   - The Zod refine() only checks "is the active provider's key set".
 *   - If a future code path were to call getModel() with a different
 *     provider override, this guard catches it.
 *   - Defensive programming at trust boundaries is cheap and prevents
 *     confusing "undefined is not a string" errors deep inside the SDK.
 */
export const getModel = (): LanguageModelV1 => {
  switch (env.LLM_PROVIDER) {
    case "anthropic": {
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic");
      }
      const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
      return anthropic(env.LLM_MODEL);
    }
    case "groq": {
      if (!env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is required when LLM_PROVIDER=groq");
      }
      const groq = createGroq({ apiKey: env.GROQ_API_KEY });
      return groq(env.LLM_MODEL);
    }
    case "google": {
      if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
        throw new Error(
          "GOOGLE_GENERATIVE_AI_API_KEY is required when LLM_PROVIDER=google",
        );
      }
      const google = createGoogleGenerativeAI({
        apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return google(env.LLM_MODEL);
    }
    case "openai": {
      if (!env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
      }
      const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
      return openai(env.LLM_MODEL);
    }
    default: {
      /*
       * Exhaustiveness check. If a future contributor adds a new value
       * to the LLM_PROVIDER enum but forgets to add a case here, the
       * TypeScript compiler will fail at this line because `exhaustive`
       * cannot be `never`. This catches the bug at compile time, not in
       * production. Pattern is sometimes called "exhaustive switch with
       * never" and is a core idiom in TypeScript.
       */
      const exhaustive: never = env.LLM_PROVIDER;
      throw new Error(`Unsupported LLM_PROVIDER: ${String(exhaustive)}`);
    }
  }
};
