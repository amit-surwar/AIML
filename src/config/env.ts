import "dotenv/config";
import { z } from "zod";

const PROVIDER_KEY_MAP = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
} as const;

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
    LLM_PROVIDER: z
      .enum(["openai", "anthropic", "groq", "google"])
      .default("groq"),
    LLM_MODEL: z.string().min(1).default("llama-3.3-70b-versatile"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .refine(
    (data): boolean => Boolean(data[PROVIDER_KEY_MAP[data.LLM_PROVIDER]]),
    (data) => ({
      message: `Missing ${PROVIDER_KEY_MAP[data.LLM_PROVIDER]} in .env for LLM_PROVIDER="${data.LLM_PROVIDER}"`,
    }),
  );

export type Env = z.infer<typeof envSchema>;

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

export const env: Env = loadEnv();
