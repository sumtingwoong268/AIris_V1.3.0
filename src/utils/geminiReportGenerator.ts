// src/utils/geminiReportGenerator.ts
import { generateReport } from "./openaiClient";

/**
 * Thin wrapper to ask the serverless endpoint for a report.
 * Returns the generated text (HTML or plaintext).
 */
export async function runGeminiReport(prompt: string, userData?: unknown): Promise<string> {
  const { text } = await generateReport({ prompt, userData });
  return text;
}
