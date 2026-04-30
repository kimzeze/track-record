import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { buildCachedSystem } from "../anthropic/client.js";
import { callJsonModel } from "../anthropic/json-call.js";
import { prompts } from "./_prompts.js";
import type { BuiltEntry } from "./entry-builder.js";

const mergeSchema = z.object({
  action: z.enum(["fresh", "merge", "append"]),
  updatedMarkdown: z.string(),
  reason: z.string(),
});

export type MergeDecision = z.infer<typeof mergeSchema>;

export async function mergeEntry(
  client: Anthropic,
  model: string,
  projectName: string,
  existingMarkdown: string,
  newEntry: BuiltEntry,
): Promise<MergeDecision> {
  const system = buildCachedSystem([prompts.entryMerger()]);
  const userText = `# projectName
${projectName}

# existingMarkdown (빈 문자열이면 fresh)
${existingMarkdown || "(empty)"}

# newEntry (JSON)
${JSON.stringify(newEntry, null, 2)}
`;
  return callJsonModel({ client, model, system, userText, schema: mergeSchema, maxTokens: 8192 });
}
