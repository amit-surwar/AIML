/**
 * ============================================================================
 *  STAGE 11  —  EXTRACTION CLI (entry point + execution flow)
 *  src/day-02-structured-outputs/index.ts
 * ============================================================================
 *
 *  ROLE
 *    The "how a human uses this" layer. Parses CLI arguments, reads
 *    input (sample / file / stdin), invokes the engine, prints results.
 *
 *  ZERO AI LOGIC LIVES HERE.
 *    This is intentional. Tomorrow if you replace the CLI with an HTTP
 *    API or a queue worker, only this file changes — the engine and
 *    extractors stay identical. Clean architecture pays off the moment
 *    you have a second way to invoke the same logic.
 *
 *  EXECUTION FLOW WHEN YOU RUN `npm run day-02 -- support-ticket --sample`
 *
 *      ┌────────────────────────────────────────────────────────────┐
 *      │ 1.  main() called by `void main()` at bottom of file       │
 *      │     ↓                                                       │
 *      │ 2.  runOnce()                                               │
 *      │     ↓                                                       │
 *      │ 3.  parseArgs(argv) → { extractorName: "support-ticket",    │
 *      │                         useSample: true, ... }              │
 *      │     ↓                                                       │
 *      │ 4.  getExtractor("support-ticket") from registry            │
 *      │     ↓                                                       │
 *      │ 5.  Choose input source: sample / file / stdin              │
 *      │     ↓                                                       │
 *      │ 6.  getModel() → provider-agnostic LLM handle (Groq, etc.)  │
 *      │     ↓                                                       │
 *      │ 7.  runExtractor(model, extractor, input)                   │
 *      │       ↓ inside the engine:                                  │
 *      │       • generateObject({ model, schema, prompts, mode })    │
 *      │       • SDK serializes Zod schema → JSON Schema             │
 *      │       • Sends as tool definition to LLM                     │
 *      │       • LLM emits tool call with structured args            │
 *      │       • SDK validates against Zod schema                    │
 *      │       • Returns typed object                                │
 *      │     ↓                                                       │
 *      │ 8.  Print JSON.stringify(result.data, null, 2) to stdout    │
 *      │     ↓                                                       │
 *      │ 9.  Log token usage                                         │
 *      └────────────────────────────────────────────────────────────┘
 *
 *  AI/ML SKILLS THIS DEMONSTRATES
 *    - Input pluralism: the same extractor works against sample text,
 *      a file, or piped stdin. Production AI systems must accept input
 *      from many sources — pipelines, file uploads, message queues.
 *    - Streaming UX rendering (ANSI clear screen + re-render). Same
 *      technique used by tools like Cursor and Claude.ai's UI.
 *    - Separation of concerns: CLI never imports `ai` package directly.
 *      All AI calls go through ../lib/extract.ts.
 * ============================================================================
 */

import { readFile } from "node:fs/promises";
import { stdin, stdout, argv, exit } from "node:process";
import { getModel } from "@/lib/llm";
import { logger } from "@/lib/logger";
import {
  getExtractor,
  listExtractors,
} from "@/day-02-structured-outputs/extractors";
import {
  runExtractor,
  streamExtractor,
} from "@/day-02-structured-outputs/lib/extract";

type CliArgs = {
  extractorName: string | undefined;
  filePath: string | undefined;
  useSample: boolean;
  useStream: boolean;
  showHelp: boolean;
};

/*
 * Tiny argv parser — no dependency (yargs/commander) needed for 5 flags.
 * In a larger CLI you'd reach for a library, but for educational code
 * keeping this dependency-free helps you read what's happening.
 */
const parseArgs = (rawArgs: readonly string[]): CliArgs => {
  let extractorName: string | undefined;
  let filePath: string | undefined;
  let useSample = false;
  let useStream = false;
  let showHelp = false;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === "--help" || arg === "-h") showHelp = true;
    else if (arg === "--sample") useSample = true;
    else if (arg === "--stream") useStream = true;
    else if (arg === "--file" || arg === "-f") {
      filePath = rawArgs[i + 1];
      i++;
    } else if (arg !== undefined && !arg.startsWith("--") && extractorName === undefined) {
      extractorName = arg;
    }
  }
  return { extractorName, filePath, useSample, useStream, showHelp };
};

/*
 * Help output also enumerates the registry — adding an extractor
 * automatically makes it discoverable without touching this function.
 */
const printHelp = (): void => {
  const lines: string[] = [];
  lines.push("Structured Outputs CLI — text in, typed object out");
  lines.push("");
  lines.push("Usage:");
  lines.push("  npm run day-02 -- <extractor> [--sample | --file <path> | (stdin)] [--stream]");
  lines.push("");
  lines.push("Examples:");
  lines.push("  npm run day-02 -- support-ticket --sample");
  lines.push("  npm run day-02 -- invoice --sample --stream");
  lines.push("  npm run day-02 -- resume --file ./samples/my-resume.txt");
  lines.push("  cat ticket.txt | npm run day-02 -- support-ticket");
  lines.push("");
  lines.push("Available extractors:");
  for (const ex of listExtractors()) {
    lines.push(`  - ${ex.name.padEnd(18)} ${ex.description}`);
  }
  stdout.write(`${lines.join("\n")}\n`);
};

/*
 * Reads piped input from stdin. Enables: cat file.txt | npm run day-02 -- ...
 * Standard Unix pattern; lets AI extractors integrate cleanly into
 * shell pipelines, log processing scripts, and CI jobs.
 */
const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
};

const formatJson = (value: unknown): string => JSON.stringify(value, null, 2);

const runOnce = async (): Promise<void> => {
  const args = parseArgs(argv.slice(2));

  if (args.showHelp || args.extractorName === undefined) {
    printHelp();
    return;
  }

  const extractor = getExtractor(args.extractorName);
  if (!extractor) {
    stdout.write(`Unknown extractor: "${args.extractorName}"\n\n`);
    printHelp();
    exit(1);
  }

  /*
   * Three input sources, one code path beyond this point.
   * This is the pluralism that lets the same extractor be reused
   * across CLI, file batch jobs, and stdin pipelines.
   */
  let input: string;
  if (args.useSample) {
    if (!extractor.sampleInput) {
      stdout.write(`Extractor "${extractor.name}" has no sample input.\n`);
      exit(1);
    }
    input = extractor.sampleInput;
  } else if (args.filePath !== undefined) {
    input = (await readFile(args.filePath, "utf-8")).trim();
  } else {
    input = await readStdin();
    if (input.length === 0) {
      stdout.write("No input provided. Use --sample, --file <path>, or pipe text via stdin.\n");
      exit(1);
    }
  }

  stdout.write(`\n=== Extractor: ${extractor.name} ===\n`);
  stdout.write(`Input length: ${input.length} chars\n`);
  stdout.write(`Mode: ${args.useStream ? "stream" : "single-shot"}\n\n`);

  /*
   * getModel() reads LLM_PROVIDER + LLM_MODEL from env and returns the
   * right provider client. The engine and extractors below are
   * provider-agnostic — they don't know if this is Groq/Llama,
   * OpenAI/GPT-4o, Anthropic/Claude, or Google/Gemini.
   */
  const model = getModel();

  if (args.useStream) {
    /*
     * Streaming render loop.
     * ANSI escape codes:
     *   \x1b[2J → clear entire screen
     *   \x1b[H  → move cursor to home (top-left)
     * Together they redraw the whole frame on each partial.
     * Same trick used by tail -f, htop, and AI coding assistants.
     */
    let lastRender = "";
    for await (const event of streamExtractor(model, extractor, input)) {
      if (event.type === "partial") {
        const rendered = formatJson(event.data);
        if (rendered !== lastRender) {
          stdout.write("\x1b[2J\x1b[H");
          stdout.write(`=== Extractor: ${extractor.name} (streaming) ===\n\n`);
          stdout.write(rendered);
          stdout.write("\n");
          lastRender = rendered;
        }
      } else if (event.type === "final") {
        stdout.write("\x1b[2J\x1b[H");
        stdout.write(`=== Extractor: ${extractor.name} (final) ===\n\n`);
        stdout.write(formatJson(event.data));
        stdout.write("\n");
      } else {
        stdout.write(`\nError: ${event.error}\n`);
        exit(1);
      }
    }
    return;
  }

  /*
   * Discriminated union handling — both branches required.
   * TypeScript narrows `result` to the correct shape inside each branch.
   * This is the Result-type pattern paying off: forced explicit handling.
   */
  const result = await runExtractor(model, extractor, input);
  if (!result.ok) {
    stdout.write(`Extraction failed: ${result.error}\n`);
    exit(1);
  }

  stdout.write(`${formatJson(result.data)}\n\n`);
  stdout.write(
    `Tokens — prompt: ${result.usage.promptTokens}, completion: ${result.usage.completionTokens}, total: ${result.usage.totalTokens}\n`,
  );
};

const main = async (): Promise<void> => {
  try {
    await runOnce();
  } catch (error) {
    logger.error("Fatal error in extraction CLI", {
      error: error instanceof Error ? error.message : String(error),
    });
    exit(1);
  }
};

void main();
