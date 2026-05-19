/**
 * ============================================================================
 *  STAGE 10  —  EXTRACTOR REGISTRY (plugin pattern)
 *  src/day-02-structured-outputs/extractors/index.ts
 * ============================================================================
 *
 *  ROLE
 *    A central map of "extractor name → extractor definition". The CLI
 *    asks this registry "do you have a 'support-ticket' extractor?" and
 *    gets back the schema + prompts to run.
 *
 *  WHY A REGISTRY
 *    Classic plugin architecture. Adding a new extractor:
 *      1. Create extractors/code-review.ts (schema + prompts).
 *      2. Add ONE line here to register it.
 *      3. Done. CLI works with the new extractor immediately.
 *    No changes to the engine, no changes to the CLI logic.
 *
 *  REAL-WORLD ANALOG
 *    This is how VS Code finds extensions, how Express discovers
 *    middleware, how OpenAI's plugin marketplace worked, how
 *    Cloudflare Workers wires bindings. Once you see this pattern
 *    once, you see it everywhere in production systems.
 *
 *  AI/ML SKILL THIS DEMONSTRATES
 *    Loose coupling between WHAT you extract (the extractors) and HOW
 *    you extract it (the engine). In a real AI platform you might have
 *    50 extractors and you'd never want to touch the engine to add a
 *    51st. This is how Anthropic, OpenAI, and HuggingFace structure
 *    their public APIs internally.
 * ============================================================================
 */

import type { z } from "zod";
import type { ExtractorDefinition } from "@/day-02-structured-outputs/lib/extract";
import { invoiceExtractor } from "@/day-02-structured-outputs/extractors/invoice";
import { resumeExtractor } from "@/day-02-structured-outputs/extractors/resume";
import { supportTicketExtractor } from "@/day-02-structured-outputs/extractors/support-ticket";

/*
 * Key by extractor.name so the CLI can look up by the string the user
 * typed on the command line (e.g. `npm run day-02 -- support-ticket`).
 * Using z.ZodTypeAny here loses per-extractor type info, but the engine
 * preserves it through generics at the actual call site.
 */
export const extractorRegistry: Record<string, ExtractorDefinition<z.ZodTypeAny>> = {
  [supportTicketExtractor.name]: supportTicketExtractor,
  [invoiceExtractor.name]: invoiceExtractor,
  [resumeExtractor.name]: resumeExtractor,
};

export const listExtractors = (): ExtractorDefinition<z.ZodTypeAny>[] =>
  Object.values(extractorRegistry);

export const getExtractor = (
  name: string,
): ExtractorDefinition<z.ZodTypeAny> | undefined => extractorRegistry[name];
