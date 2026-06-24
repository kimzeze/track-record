import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { buildCachedSystem } from "../anthropic/client.js";
import { callJsonModel } from "../anthropic/json-call.js";
import type { UsageTracker } from "../anthropic/usage.js";
import type { CategoryBlock, EntryBlock } from "../vault/parser.js";
import { sortEntries } from "../vault/parser.js";
import { prompts } from "./_prompts.js";

const compactionSchema = z.object({
  merges: z.array(
    z.object({
      primaryId: z.string(),
      mergeIds: z.array(z.string()),
      headline: z.string(),
      body: z.string(),
      reason: z.string(),
    }),
  ),
});

export type CompactionResult = z.infer<typeof compactionSchema>;

function entryId(index: number): string {
  return `e${index}`;
}

export async function compactCategory(
  client: Anthropic,
  model: string,
  projectName: string,
  category: CategoryBlock,
  maxTokens: number,
  tracker?: UsageTracker,
): Promise<CompactionResult> {
  const entries = category.entries.map((e, i) => ({
    id: entryId(i),
    headline: e.headline,
    body: e.bodyLines.join("\n"),
  }));

  const system = buildCachedSystem([prompts.compactor()]);
  const userText = `# project
${projectName}

# category
${category.name}

# entries (JSON)
${JSON.stringify(entries, null, 2)}
`;

  return callJsonModel({
    client,
    model,
    system,
    userText,
    schema: compactionSchema,
    maxTokens,
    tracker,
  });
}

// 여러 entry 의 metaLine 을 결정론적으로 합친다 (PR 링크 합집합 · 날짜 desc · stack 합집합).
// LLM 에 맡기지 않는다 — 멱등성 키(PR 번호)가 여기 박혀 있으므로 포맷 드리프트를 차단.
export function combineMetaLines(entries: EntryBlock[]): string {
  const prLinks: string[] = [];
  const seenPr = new Set<string>();
  const dates = new Set<string>();
  const stacks: string[] = [];

  for (const e of entries) {
    for (const m of e.metaLine.matchAll(/\[PR #\d+\](?:\([^)]*\))?/g)) {
      if (!seenPr.has(m[0])) {
        seenPr.add(m[0]);
        prLinks.push(m[0]);
      }
    }
    for (const m of e.metaLine.matchAll(/\d{4}-\d{2}-\d{2}/g)) dates.add(m[0]);
    for (const m of e.metaLine.matchAll(/`[^`]+`/g)) {
      if (!stacks.includes(m[0])) stacks.push(m[0]);
    }
  }

  const parts: string[] = [];
  if (prLinks.length > 0) parts.push(prLinks.join(" "));
  if (dates.size > 0) parts.push([...dates].sort().reverse().join(", "));
  if (stacks.length > 0) parts.push(stacks.join(" "));
  return parts.join(" · ");
}

function trimEdges(lines: string[]): string[] {
  const out = [...lines];
  while (out.length > 0 && (out[0] ?? "").trim() === "") out.shift();
  while (out.length > 0 && (out[out.length - 1] ?? "").trim() === "") out.pop();
  return out;
}

export interface ApplyMergesResult {
  changed: boolean;
  mergedGroups: number;
}

// LLM 의 통합 결정을 category 에 결정론적으로 적용한다. 통합 안 된 entry 는 손대지 않는다.
export function applyMerges(category: CategoryBlock, result: CompactionResult): ApplyMergesResult {
  const byId = new Map<string, EntryBlock>();
  category.entries.forEach((e, i) => byId.set(entryId(i), e));

  const toRemove = new Set<EntryBlock>();
  let mergedGroups = 0;

  for (const group of result.merges) {
    const primary = byId.get(group.primaryId);
    if (!primary || toRemove.has(primary)) continue;

    const absorbed = group.mergeIds
      .map((id) => byId.get(id))
      .filter((e): e is EntryBlock => e !== undefined && e !== primary && !toRemove.has(e));
    if (absorbed.length === 0) continue;

    const all = [primary, ...absorbed];
    const newHeadline = group.headline.trim();
    const newBody = trimEdges(group.body.split("\n"));
    if (newHeadline === "" || newBody.length === 0) continue;

    primary.headline = newHeadline;
    primary.bodyLines = newBody;
    primary.metaLine = combineMetaLines(all);
    primary.prNumbers = [...new Set(all.flatMap((e) => e.prNumbers))];
    primary.date = all.map((e) => e.date).filter(Boolean).sort().reverse()[0] ?? primary.date;

    for (const a of absorbed) toRemove.add(a);
    mergedGroups += 1;
  }

  if (mergedGroups === 0) return { changed: false, mergedGroups: 0 };

  category.entries = category.entries.filter((e) => !toRemove.has(e));
  sortEntries(category.entries);
  return { changed: true, mergedGroups };
}
