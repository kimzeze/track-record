import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { buildCachedSystem } from "../anthropic/client.js";
import { callJsonModel } from "../anthropic/json-call.js";
import type { PRContext } from "../github/pr-context.js";
import { prompts } from "./_prompts.js";
import { renderPRForLLM } from "./_render.js";

const matcherSchema = z.object({
  skills: z.array(z.string()),
});

export type SkillMatch = z.infer<typeof matcherSchema>;

export async function matchSkills(
  client: Anthropic,
  model: string,
  pr: PRContext,
): Promise<SkillMatch> {
  const system = buildCachedSystem([prompts.skillMatcher()]);
  const userText = renderPRForLLM(pr);
  return callJsonModel({ client, model, system, userText, schema: matcherSchema, maxTokens: 512 });
}
