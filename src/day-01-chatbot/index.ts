/**
 * ============================================================================
 *  STAGE 5  —  CONVERSATIONAL AGENT (streaming chat with tool calling)
 *  src/day-01-chatbot/index.ts
 * ============================================================================
 *
 *  ROLE
 *    The first end-to-end agent. Takes user input from the terminal,
 *    streams the model's response, transparently calls tools when the
 *    model decides to, and maintains multi-turn memory.
 *
 *  WHAT MAKES THIS AN "AGENT"
 *    An agent = LLM + tools + a loop that lets the model reason across
 *    multiple steps (think → call tool → see result → think → answer).
 *    The `maxSteps: 5` parameter below is what turns a one-shot
 *    completion into an agentic loop. Without it, the model could
 *    only call one tool per user message.
 *
 *  EXECUTION FLOW (per user message)
 *
 *      ┌────────────────────────────────────────────────────────────┐
 *      │ 1.  Read user input from stdin (readline.question)         │
 *      │     ↓                                                       │
 *      │ 2.  Append { role: 'user', content } to history             │
 *      │     ↓                                                       │
 *      │ 3.  streamText({ model, system, messages, tools, maxSteps })│
 *      │     ↓                                                       │
 *      │ 4.  Iterate result.fullStream events:                       │
 *      │       • text-delta   → write token to stdout                │
 *      │       • tool-call    → print "[tool] name(args)"            │
 *      │       • tool-result  → print "=> {...}"                     │
 *      │       (the SDK transparently feeds tool-results back into   │
 *      │        the model and continues, up to maxSteps times)       │
 *      │     ↓                                                       │
 *      │ 5.  Append the model's response messages to history         │
 *      │     ↓                                                       │
 *      │ 6.  Log usage (prompt/completion/total tokens)              │
 *      │     ↓                                                       │
 *      │ 7.  Loop back to step 1                                     │
 *      └────────────────────────────────────────────────────────────┘
 *
 *  AI/ML SKILLS THIS BUILDS
 *    - Streaming UX: tokens arrive one at a time → write to stdout as
 *      they come in. Same pattern powers ChatGPT, Claude.ai, Cursor.
 *    - Multi-turn state: there's no "memory" inside the model — the
 *      `history` array IS the memory. Every turn sends the FULL history.
 *    - Tool orchestration: the model decides when/whether to call tools,
 *      based on the user's intent and the tool descriptions.
 *    - The `fullStream` pattern: we listen to ALL events (text, tool
 *      calls, tool results) — not just text. This makes the agent
 *      transparent: you SEE it reasoning.
 *    - Graceful interrupt: Ctrl+C / EOF closes the readline; the
 *      AbortError is caught and ignored instead of crashing.
 *
 *  PRODUCTION ANALOG
 *    Replace this CLI's readline with a WebSocket and you have the
 *    backbone of ChatGPT's web UI. Replace it with a queue consumer
 *    and you have an async batch agent. The agent loop itself is
 *    identical.
 * ============================================================================
 */

import { streamText, type CoreMessage } from "ai";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getModel } from "@/lib/llm";
import { logger } from "@/lib/logger";
import { chatbotTools } from "@/day-01-chatbot/tools";

/*
 * SYSTEM PROMPT — sent once per turn, sets the model's role/behavior.
 * Two important rules baked in:
 *   - "Use tools when asked to compute or get the current time."
 *     This nudges the model to actually CALL tools rather than guess.
 *   - "After a tool returns, ALWAYS write a short natural-language answer."
 *     Open models (Llama on Groq) sometimes terminate after a tool result
 *     without writing follow-up text. Explicit instruction fixes that.
 */
const SYSTEM_PROMPT = `You are a helpful AI assistant for an engineer who is learning AI Engineering.
- Be concise and technical.
- When asked to compute or get the current time, use the provided tools.
- After a tool returns a result, ALWAYS write a short natural-language answer that uses the result.
- Prefer correctness over confidence; say "I don't know" when unsure.`;

const printBanner = (): void => {
  output.write("\n");
  output.write("AI Engineering Sprint — Streaming Chatbot\n");
  output.write("Type your message and press Enter. Type ':exit' or Ctrl+C to quit.\n");
  output.write("Try: 'What is (1234 * 9) / 3?' or 'What time is it right now?'\n");
  output.write("\n");
};

/*
 * Helper to recognize the readline "I was aborted" error. Used to exit
 * the loop cleanly on Ctrl+C without logging it as a "fatal error".
 */
const isAbortError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.name === "AbortError" || error.message.includes("Aborted");
  }
  return false;
};

const runChat = async (): Promise<void> => {
  const model = getModel();
  const rl = readline.createInterface({ input, output });

  /*
   * The conversation memory. CoreMessage is the AI SDK's union type
   * over { role, content }. Roles: 'system', 'user', 'assistant', 'tool'.
   *
   * This array IS the model's only memory across turns. If you don't
   * push to it, the model forgets everything. If you trim it (which
   * production apps do once it grows past the model's context window),
   * you must be strategic about what to keep.
   */
  const history: CoreMessage[] = [];

  /*
   * AbortController is wired to readline close. This lets us cleanly
   * stop in-flight LLM streams when the user presses Ctrl+C.
   * (We don't actually pass this signal into streamText here — but
   * the readline abort is what unblocks the loop.)
   */
  const abortController = new AbortController();
  rl.on("close", (): void => abortController.abort());

  printBanner();

  try {
    while (true) {
      let userInput: string;
      try {
        userInput = (await rl.question("you  > ")).trim();
      } catch (error) {
        if (isAbortError(error)) break;
        throw error;
      }
      if (userInput.length === 0) continue;
      if (userInput === ":exit" || userInput === ":quit") break;

      history.push({ role: "user", content: userInput });

      output.write("ai   > ");

      try {
        /*
         * streamText is the core call. Key parameters:
         *   - model:    provider-agnostic handle from getModel()
         *   - system:   the persistent role/policy prompt
         *   - messages: the full conversation history
         *   - tools:    available functions the model can call
         *   - maxSteps: max number of reasoning steps in this turn
         *               (a "step" = one model call + optional tool exec).
         *               5 is enough for most agentic flows; raise to 10
         *               for more complex multi-tool workflows.
         */
        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: history,
          tools: chatbotTools,
          maxSteps: 5,
        });

        let assistantText = "";
        let sawTextThisStep = false;

        /*
         * fullStream is the firehose: it emits EVERY event from the
         * model + tools, not just text deltas. We pattern-match on
         * the event type to render appropriately. This is what makes
         * the agent transparent — you see [tool] calls inline.
         */
        for await (const part of result.fullStream) {
          switch (part.type) {
            case "text-delta": {
              assistantText += part.textDelta;
              sawTextThisStep = true;
              output.write(part.textDelta);
              break;
            }
            case "tool-call": {
              /*
               * The model has emitted a tool invocation. The SDK has
               * already validated the args against the tool's Zod
               * schema by the time we see this event. The actual
               * execute() runs immediately after (yielding 'tool-result').
               */
              output.write(
                `\n  [tool] ${part.toolName}(${JSON.stringify(part.args)})`,
              );
              break;
            }
            case "tool-result": {
              /*
               * The tool's execute() returned. The SDK will now feed
               * this result back to the model as a 'tool' role message
               * and continue the next reasoning step (up to maxSteps).
               */
              output.write(
                ` => ${JSON.stringify(part.result)}\n  ai   > `,
              );
              sawTextThisStep = false;
              break;
            }
            case "error": {
              const err = part.error;
              logger.error("stream error event", {
                error: err instanceof Error ? err.message : String(err),
              });
              break;
            }
            default:
              break;
          }
        }

        /*
         * Defensive UX: if the model only called a tool and didn't
         * generate any follow-up text, let the user know rather than
         * leaving them staring at silence.
         */
        if (!sawTextThisStep && assistantText.length === 0) {
          output.write("(no text returned — model relied on tool output)");
        }
        output.write("\n");

        /*
         * Persist the full model response (which can be multiple
         * messages — text, tool calls, tool results) into history.
         * This is what gives the model "memory" of past turns.
         */
        const finalMessages = (await result.response).messages;
        history.push(...finalMessages);

        /*
         * Token accounting. In production you'd:
         *   - sum these into a per-user / per-session counter
         *   - emit to Prometheus / Datadog as a metric
         *   - alert if a single turn exceeds a threshold (loop detection)
         */
        const usage = await result.usage;
        const finishReason = await result.finishReason;
        logger.debug("turn complete", {
          finishReason,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        });
      } catch (error) {
        /*
         * Per-turn error boundary. We DON'T break the loop — the user
         * gets to try another message. Crashing the whole REPL on a
         * single 429 rate limit would be bad UX.
         */
        output.write("\n");
        logger.error("LLM call failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    rl.close();
    output.write("\nGoodbye.\n");
  }
};

const main = async (): Promise<void> => {
  try {
    await runChat();
  } catch (error) {
    /*
     * AbortError on Ctrl+C is expected, not a crash. Exit cleanly
     * with code 0 in that case so the parent shell shows a normal exit.
     */
    if (isAbortError(error)) {
      process.exit(0);
    }
    logger.error("Fatal error in chatbot", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
};

void main();
