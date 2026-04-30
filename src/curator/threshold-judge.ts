import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { buildCachedSystem } from "../anthropic/client.js";
import { callJsonModel } from "../anthropic/json-call.js";
import type { PRContext } from "../github/pr-context.js";
import { prompts } from "./_prompts.js";
import { renderPRForLLM } from "./_render.js";

const judgeSchema = z.object({
  pass: z.boolean(),
  category: z.enum(["tech-depth", "impact", "both", "neither"]),
  reason: z.string(),
});

export type ThresholdJudgement = z.infer<typeof judgeSchema>;

export async function judgeThreshold(
  client: Anthropic,
  model: string,
  pr: PRContext,
): Promise<ThresholdJudgement> {
  const system = buildCachedSystem([prompts.thresholdJudge()]);
  const userText = renderPRForLLM(pr);
  return callJsonModel({ client, model, system, userText, schema: judgeSchema, maxTokens: 1024 });
}
