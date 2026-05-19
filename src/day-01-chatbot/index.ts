import { streamText, type CoreMessage } from "ai";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getModel } from "@/lib/llm";
import { logger } from "@/lib/logger";
import { chatbotTools } from "@/day-01-chatbot/tools";

const SYSTEM_PROMPT = `You are a helpful AI assistant for an engineer who is learning AI Engineering.
- Be concise and technical.
- When asked to compute or get the current time, use the provided tools.
- After a tool returns a result, ALWAYS write a short natural-language answer that uses the result.
- Prefer correctness over confidence; say "I don't know" when unsure.`;

const printBanner = (): void => {
  output.write("\n");
  output.write("AI Engineering Sprint — Day 1: Streaming Chatbot\n");
  output.write("Type your message and press Enter. Type ':exit' or Ctrl+C to quit.\n");
  output.write("Try: 'What is (1234 * 9) / 3?' or 'What time is it right now?'\n");
  output.write("\n");
};

const isAbortError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.name === "AbortError" || error.message.includes("Aborted");
  }
  return false;
};

const runChat = async (): Promise<void> => {
  const model = getModel();
  const rl = readline.createInterface({ input, output });
  const history: CoreMessage[] = [];
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
        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: history,
          tools: chatbotTools,
          maxSteps: 5,
        });

        let assistantText = "";
        let sawTextThisStep = false;

        for await (const part of result.fullStream) {
          switch (part.type) {
            case "text-delta": {
              assistantText += part.textDelta;
              sawTextThisStep = true;
              output.write(part.textDelta);
              break;
            }
            case "tool-call": {
              output.write(
                `\n  [tool] ${part.toolName}(${JSON.stringify(part.args)})`,
              );
              break;
            }
            case "tool-result": {
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

        if (!sawTextThisStep && assistantText.length === 0) {
          output.write("(no text returned — model relied on tool output)");
        }
        output.write("\n");

        const finalMessages = (await result.response).messages;
        history.push(...finalMessages);

        const usage = await result.usage;
        const finishReason = await result.finishReason;
        logger.debug("turn complete", {
          finishReason,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        });
      } catch (error) {
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
