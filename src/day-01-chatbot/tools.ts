import { tool } from "ai";
import { z } from "zod";

export const calculatorTool = tool({
  description:
    "Evaluate a basic arithmetic expression. Supports + - * / ( ) and decimals. No variables.",
  parameters: z.object({
    expression: z
      .string()
      .min(1)
      .max(200)
      .describe("The arithmetic expression, e.g. '(12.5 * 4) / 2'"),
  }),
  execute: async ({ expression }): Promise<{ result: number } | { error: string }> => {
    const safe = /^[\d+\-*/().\s]+$/.test(expression);
    if (!safe) return { error: "Expression contains disallowed characters." };
    try {
      const result = Function(`"use strict"; return (${expression});`)() as unknown;
      if (typeof result !== "number" || !Number.isFinite(result)) {
        return { error: "Expression did not evaluate to a finite number." };
      }
      return { result };
    } catch {
      return { error: "Failed to evaluate expression." };
    }
  },
});

type TimeResult = {
  iso: string;
  unix: number;
  timezone: string;
  formatted: string;
};

export const currentTimeTool = tool({
  description:
    "Returns the current date and time. Accepts an optional IANA timezone (e.g. 'Asia/Kolkata', 'America/New_York'). Defaults to UTC.",
  parameters: z.object({
    timezone: z
      .string()
      .min(1)
      .max(64)
      .optional()
      .describe(
        "Optional IANA timezone identifier, e.g. 'Asia/Kolkata'. Omit for UTC.",
      ),
  }),
  execute: async ({ timezone }): Promise<TimeResult | { error: string }> => {
    const now = new Date();
    const tz = timezone ?? "UTC";
    try {
      const formatted = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        dateStyle: "full",
        timeStyle: "long",
      }).format(now);
      return {
        iso: now.toISOString(),
        unix: Math.floor(now.getTime() / 1000),
        timezone: tz,
        formatted,
      };
    } catch {
      return { error: `Invalid timezone: '${tz}'. Use an IANA name like 'Asia/Kolkata'.` };
    }
  },
});

export const chatbotTools = {
  calculator: calculatorTool,
  currentTime: currentTimeTool,
};
