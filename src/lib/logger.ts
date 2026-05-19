import { env } from "@/config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

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

const write = (level: LogLevel, message: string, meta?: Record<string, unknown>): void => {
  if (!shouldLog(level)) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta: redact(meta) } : {}),
  };
  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
  stream.write(`${JSON.stringify(entry)}\n`);
};

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>): void => write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>): void => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>): void => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>): void => write("error", message, meta),
};
