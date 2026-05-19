import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";
import { env } from "@/config/env";

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
      const exhaustive: never = env.LLM_PROVIDER;
      throw new Error(`Unsupported LLM_PROVIDER: ${String(exhaustive)}`);
    }
  }
};
