/**
 * ============================================================================
 *  STAGE 9  —  EXTRACTOR: Resume / CV Parser
 *  src/day-02-structured-outputs/extractors/resume.ts
 * ============================================================================
 *
 *  ROLE
 *    Parse free-form resume text into a structured candidate profile
 *    suitable for an Applicant Tracking System (ATS) or recruiter
 *    pipeline.
 *
 *  REAL-WORLD ANALOG
 *    LinkedIn Recruiter, Greenhouse, Lever, AshbyHQ, Workable — all use
 *    near-identical schemas behind their resume-import features. Before
 *    LLMs, resume parsing was a multi-million-dollar industry of brittle
 *    regex + NLP libraries (sovren, daxtra, hireability). Today: this file.
 *
 *  AI/ML SKILLS THIS DEMONSTRATES
 *    1. DEEP NESTED schemas — top-level fields contain arrays of objects
 *       (work_experience, education). Zod composes these cleanly.
 *    2. DERIVED FIELDS — years_of_experience is computed by the model
 *       from dates it sees, not a number explicit in the text. Telling
 *       the model "estimate from dates" via .describe() works.
 *    3. CANONICALIZATION — skills are extracted as short canonical
 *       names ("TypeScript", not "Strong TypeScript expert with 8 years").
 *       This is critical for downstream search/match (otherwise every
 *       candidate has unique skill strings and you can't query them).
 *    4. CLASSIFICATION into a role taxonomy — `primary_role` is the
 *       model picking the best-fit single label from a fixed list.
 *       Useful for routing candidates to the right recruiter.
 * ============================================================================
 */

import { z } from "zod";
import type { ExtractorDefinition } from "@/day-02-structured-outputs/lib/extract";

/*
 * Sub-schema: one work experience entry. Nested under the main schema.
 *
 * Note start_date / end_date are STRINGS, not Date objects, because:
 *   - JSON has no native Date type.
 *   - We want the canonical format (YYYY-MM) for downstream sorting/filtering.
 *   - end_date is nullable specifically for current roles.
 *   - is_current is a redundant boolean, but storing it explicitly
 *     means consumers don't have to special-case null parsing.
 *     (Redundancy in schemas is fine when it makes downstream code simpler.)
 */
const workExperienceSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  start_date: z
    .string()
    .describe("Year-month as YYYY-MM. Use YYYY-01 if only year is given."),
  end_date: z
    .string()
    .nullable()
    .describe("Year-month as YYYY-MM. null if current role."),
  is_current: z.boolean(),
  description: z.string().nullable(),
});

const educationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  field_of_study: z.string().nullable(),
  graduation_year: z.number().int().min(1950).max(2100).nullable(),
});

const resumeSchema = z.object({
  full_name: z.string().min(1),
  headline: z
    .string()
    .nullable()
    .describe("One-line professional summary, e.g. 'Senior Full-Stack Engineer'."),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),

  /*
   * DERIVED FIELD — the resume text rarely says "I have 8 years of experience"
   * explicitly. The model must compute it by summing distinct work periods.
   * The .describe() explicitly instructs how to compute. This is the LLM
   * doing data engineering you'd previously write Python for.
   */
  years_of_experience: z
    .number()
    .nonnegative()
    .describe("Total years of professional experience. Estimate from dates."),

  /*
   * Single-label classification. From an arbitrary resume, the model
   * picks ONE primary_role from this list. Useful for routing candidates
   * to the recruiter who handles that specialization. Without enums,
   * you'd get free-text values like "Software Engineer III specializing
   * in distributed systems" — useless for filtering.
   */
  primary_role: z
    .enum([
      "frontend",
      "backend",
      "fullstack",
      "mobile",
      "devops",
      "data",
      "ml_ai",
      "qa",
      "design",
      "product",
      "manager",
      "other",
    ])
    .describe("Best-fit primary role classification."),

  /*
   * CANONICALIZATION — see system prompt for the rule. We cap at 40
   * because resumes sometimes list 80+ "skills" (every tool they've
   * touched). Forcing a cap also forces the model to prioritize.
   */
  skills: z.array(z.string().min(1).max(40)).max(40),

  /*
   * Composing nested schemas.
   * Each item is a fully-typed workExperienceSchema object.
   * If you later need to insert these into a separate `work_experiences`
   * DB table, the Zod type maps directly to your DB model.
   */
  work_experience: z.array(workExperienceSchema),
  education: z.array(educationSchema),
});

export type Resume = z.infer<typeof resumeSchema>;

export const resumeExtractor: ExtractorDefinition<typeof resumeSchema> = {
  name: "resume",
  description: "Parse a resume or CV into structured profile data.",
  schema: resumeSchema,

  /*
   * System prompt encodes the rules that don't fit into the schema:
   *   - HOW to estimate years_of_experience (sum, cap overlaps).
   *   - The canonicalization rule for skills.
   *   - The non-fabrication rule for missing fields.
   * Schema = format. System prompt = judgment + computation rules.
   */
  systemPrompt: `You are a resume parser used in an applicant tracking system.
- Be precise about dates; normalize to YYYY-MM.
- Estimate years_of_experience by summing distinct work periods, capping overlaps.
- Skills should be concise canonical names (e.g. "TypeScript", not "Strong TypeScript expert"). Cap at 40.
- If a field is missing, use null where allowed. Never invent employers, schools, or dates.`,

  buildPrompt: (input): string =>
    `Parse the following resume text into the schema.

--- RESUME TEXT ---
${input}
--- END ---`,

  /*
   * The sample resembles YOUR background. Useful for two reasons:
   *   1. You can read the output and judge if the role classification,
   *      years_of_experience, and skills feel right for YOU.
   *   2. It tests overlap detection (3 jobs back-to-back) and current
   *      role handling (end_date: null, is_current: true).
   */
  sampleInput: `Amit Kumar
Senior Software Engineer | React Native, Node.js, DevOps
amit.example@gmail.com | +91 90000 11111 | Hyderabad, India

PROFESSIONAL EXPERIENCE

Zazz Software Pvt Ltd — Senior React Native Engineer
March 2022 - Present
- Led migration of legacy React Native app to New Architecture (Fabric/TurboModules)
- Owned CI/CD pipelines on AWS CodeBuild + Fastlane

Acme Tech — Full Stack Engineer
June 2019 - February 2022
- Built REST and GraphQL APIs in Node.js (Express, Fastify)
- Set up Kubernetes clusters and Terraform modules

Startup XYZ — Junior Developer
August 2018 - May 2019
- React + Redux frontend work

EDUCATION
B.Tech in Computer Science, IIT Hyderabad, 2018

SKILLS
React Native, React, TypeScript, Node.js, Express, Fastify, GraphQL, AWS, Docker, Kubernetes, Terraform, PostgreSQL, MongoDB, Redis, CI/CD, Fastlane`,
};
