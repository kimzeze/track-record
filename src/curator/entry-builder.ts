import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { buildCachedSystem } from "../anthropic/client.js";
import { callJsonModel } from "../anthropic/json-call.js";
import type { PRContext } from "../github/pr-context.js";
import { prompts } from "./_prompts.js";
import { renderPRForLLM } from "./_render.js";

const builtSchema = z.object({
  category: z.string(),
  headline: z.string(),
  metaLine: z.string(),
  body: z.string(),
});

export type BuiltEntry = z.infer<typeof builtSchema>;

export async function buildEntry(
  client: Anthropic,
  model: string,
  pr: PRContext,
  matchedSkills: string[],
): Promise<BuiltEntry> {
  const skillBodies = matchedSkills.map((name) => {
    try {
      return `## 참조 스킬: ${name}\n\n${prompts.stack(name)}`;
    } catch {
      return `## 참조 스킬: ${name}\n\n(로드 실패)`;
    }
  });

  const system = buildCachedSystem([prompts.entryBuilder(), ...skillBodies]);
  const userText = renderPRForLLM(pr);
  return callJsonModel({ client, model, system, userText, schema: builtSchema, maxTokens: 2048 });
}

export function builtEntryToMarkdown(entry: BuiltEntry): string {
  return `## ${entry.category}\n### ${entry.headline}\n${entry.metaLine}\n\n${entry.body}\n`;
}
