/**
 * ============================================================================
 *  STAGE 2  —  STRUCTURED LOGGING (runs from start to end of every request)
 *  src/lib/logger.ts
 * ============================================================================
 *
 *  ROLE
 *    A tiny, dependency-free JSON logger with level filtering and
 *    automatic redaction of secret-looking fields.
 *
 *  WHY NOT console.log?
 *    Plain console.log is ungreppable, unparseable, and trivially leaks
 *    secrets. In an AI system you'll log: prompts, responses, token
 *    counts, errors, latencies. Several of these can contain API keys,
 *    user PII, or accidental copies of customer data. A structured
 *    redacting logger is the cheapest defense.
 *
 *  WHY NOT pino / winston / bunyan?
 *    Educational simplicity. The 50 lines below are enough for the
 *    whole sprint. In a real production app you'd swap this for pino
 *    (Node) or @opentelemetry/api — the interface is intentionally
 *    similar so the swap is a 1-line change.
 *
 *  AI/ML SKILLS THIS BUILDS
 *    - Observability literacy. Real AI platforms ingest these JSON
 *      logs into Datadog / Honeycomb / Loki and slice them by
 *      tokens_used, finish_reason, model, latency_p95, etc. Without
 *      structured logs you can't see your own system.
 *    - PII discipline. The redaction pass is a habit you carry into
 *      every project. Even the AI doesn't get to see your raw secrets.
 * ============================================================================
 */

import { env } from "@/config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

/*
 * Numeric priorities — used to filter messages below the configured
 * LOG_LEVEL. The lower the number, the more verbose. In production
 * you typically set LOG_LEVEL=info; for local dev or AI debugging you
 * set LOG_LEVEL=debug to see prompts and token counts.
 */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/*
 * The secret-redaction allowlist. ANY field whose key (case-insensitive)
 * is in this set will be replaced with "[REDACTED]" before being logged.
 * Include EVERY name your codebase uses for secrets. Forgetting one is
 * how production accidents happen.
 *
 * In real-world AI systems you'd also redact: "messages", "prompt",
 * "user_input" — anything that may contain customer data subject to
 * privacy regulations (GDPR, HIPAA, DPDP Act in India, etc.).
 */
const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "api_key",
  "apikey",
  "authorization",
  "secret",
  "openai_api_key",
  "anthropic_api_key",
]);

/*
 * Walk an arbitrary value and return a deep copy with sensitive keys
 * masked. Recursive so it handles nested objects (e.g. logging an
 * Axios error which contains config.headers.Authorization).
 *
 * Notes:
 *   - Returns unknown to keep callers honest about what they're logging.
 *   - Doesn't traverse Maps/Sets (rare in log payloads).
 *   - Arrays are walked but not masked at the array level (only their
 *     object items).
 */
const redact = (value: unknown): unknown => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redact(item));
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redact(val);
  }
  return out;
};

const shouldLog = (level: LogLevel): boolean =>
  LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[env.LOG_LEVEL];

/*
 * Single write function used by every level. Emits one JSON object per
 * line (NDJSON format) — the industry-standard structured log shape that
 * Datadog, Splunk, Loki, CloudWatch Insights, BigQuery etc. all ingest
 * natively. One JSON per line ⇒ greppable, parseable, queryable.
 */
const write = (level: LogLevel, message: string, meta?: Record<string, unknown>): void => {
  if (!shouldLog(level)) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta: redact(meta) } : {}),
  };
  /*
   * warn/error go to stderr; debug/info go to stdout.
   * Why? Lots of CLI tooling separates the two streams. Errors should
   * never pollute the program's "output" (which downstream tools may pipe).
   */
  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
  stream.write(`${JSON.stringify(entry)}\n`);
};

/*
 * Public API — call sites look like:
 *   logger.debug("turn complete", { totalTokens });
 *   logger.error("LLM call failed", { error: err.message });
 *
 * The `meta` arg is optional and goes through redact() before write.
 */
export const logger = {
  debug: (message: string, meta?: Record<string, unknown>): void => write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>): void => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>): void => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>): void => write("error", message, meta),
};
