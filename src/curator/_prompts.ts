import { readFileSync } from "node:fs";
import { join } from "node:path";

function load(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

export const promptPaths = {
  thresholdJudge: "prompts/curator/threshold-judge.md",
  skillMatcher: "prompts/curator/skill-matcher.md",
  entryBuilder: "prompts/curator/entry-builder.md",
  entryMerger: "prompts/curator/entry-merger.md",
} as const;

export const prompts = {
  thresholdJudge: () => load(promptPaths.thresholdJudge),
  skillMatcher: () => load(promptPaths.skillMatcher),
  entryBuilder: () => load(promptPaths.entryBuilder),
  entryMerger: () => load(promptPaths.entryMerger),
  stack: (name: string) => load(`prompts/stacks/${name}.md`),
};
