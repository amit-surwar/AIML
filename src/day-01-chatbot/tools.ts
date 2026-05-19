/**
 * ============================================================================
 *  STAGE 4  —  TOOLS  (the LLM's "hands" — code it can call)
 *  src/day-01-chatbot/tools.ts
 * ============================================================================
 *
 *  ROLE
 *    Defines functions the LLM is allowed to invoke during a conversation.
 *    Each tool has a name, description, Zod-validated parameters, and an
 *    `execute` function that runs in YOUR Node.js process — NOT inside
 *    the model.
 *
 *  THE CORE MENTAL MODEL OF "TOOL CALLING"
 *    1. You define tools with schemas (Zod → JSON Schema).
 *    2. You send tool definitions WITH each chat request.
 *    3. The model decides whether to answer directly OR emit a
 *       structured "call this tool with these args" response.
 *    4. The SDK validates the args against your Zod schema.
 *    5. Your `execute` function runs and returns a result.
 *    6. The SDK feeds the result back to the model as a tool message.
 *    7. The model continues the conversation using the result.
 *
 *    The model never executes your code. It only emits the *request*
 *    to execute it. Your runtime stays in control of side effects.
 *
 *  REAL-WORLD ANALOG
 *    Tool calling is what gives ChatGPT plugins, Claude's tools,
 *    Cursor's IDE integration, GitHub Copilot's terminal commands,
 *    and every "AI agent" their actual abilities. Without tools, an
 *    LLM is just a chat box. With tools, it can read your filesystem,
 *    query your database, hit any API, and orchestrate workflows.
 *
 *  TWO RULES YOU'LL CARRY FOREVER (learned the hard way)
 *    1. Never define a tool with zero parameters. Many open-weight
 *       models emit `null` instead of `{}` for empty-arg tool calls,
 *       which fails Zod validation. Always include at least one
 *       meaningful optional parameter (here: `timezone`).
 *    2. Tools should be small, deterministic, and side-effect-aware.
 *       Don't write tools that send emails or charge credit cards
 *       unless you've thought hard about safety. The LLM can and will
 *       call them in unexpected sequences.
 * ============================================================================
 */

import { tool } from "ai";
import { z } from "zod";

/*
 * Calculator tool.
 *
 * Why a calculator? Because LLMs are notoriously bad at arithmetic for
 * anything beyond simple cases — they predict tokens, not numbers. The
 * standard fix is to give them a calculator. This is the canonical
 * teaching example of "use a tool to escape the model's weaknesses".
 *
 * SAFETY: the regex restricts the expression to digits and operators
 * before passing to Function(). Without that allowlist, the model
 * could inject arbitrary JavaScript ("process.exit(1)") and we'd run
 * it. NEVER eval / Function() user (or LLM) input without sanitizing.
 */
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

/*
 * Strong return type for the time tool. Returning a typed object instead
 * of a free-form string helps the model (it sees a structured result) and
 * makes the tool composable with downstream code.
 */
type TimeResult = {
  iso: string;
  unix: number;
  timezone: string;
  formatted: string;
};

/*
 * Current-time tool.
 *
 * Why does an LLM need this? Because the model has no concept of "now".
 * Its training data has a cutoff; it cannot know the wall-clock time.
 * Anything time-dependent (greetings, deadlines, freshness checks)
 * requires a tool like this.
 *
 * The timezone parameter is ALSO the bug-fix from earlier: by giving
 * the tool a meaningful optional parameter, we avoid the "model emits
 * null for zero-arg tool" issue with Llama/Qwen-style models. And it
 * happens to make the tool more useful — IST vs UTC matters daily.
 */
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
      /*
       * Intl.DateTimeFormat is the standard, dependency-free way to
       * format dates per timezone. The model often picks the right
       * IANA name from natural language ("Hyderabad" → "Asia/Kolkata")
       * because IANA names are well-represented in training data.
       */
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
      /*
       * Returning a structured { error } object instead of throwing.
       * Why? The model receives this as the tool result and can
       * gracefully apologize / ask the user for a real timezone.
       * Throwing would crash the streaming turn and confuse the model.
       *
       * Pattern: tools return Result-like shapes ({ result } | { error }),
       * never throw. This makes the agent loop robust.
       */
      return { error: `Invalid timezone: '${tz}'. Use an IANA name like 'Asia/Kolkata'.` };
    }
  },
});

/*
 * Tool registry handed to streamText/generateText.
 * Add a tool → register it here → it becomes available in every turn.
 * The keys are the names the model will see and call.
 */
export const chatbotTools = {
  calculator: calculatorTool,
  currentTime: currentTimeTool,
};
