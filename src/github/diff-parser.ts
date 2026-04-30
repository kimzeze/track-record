export interface ParsedFile {
  path: string;
  status: "added" | "removed" | "modified" | "renamed" | "changed" | "copied" | "unchanged";
  additions: number;
  deletions: number;
  patch?: string;
}

export interface ParsedDiff {
  files: ParsedFile[];
  totalAdditions: number;
  totalDeletions: number;
}

export function isExcluded(path: string, patterns: string[]): boolean {
  return patterns.some((p) => {
    if (p.includes("*")) {
      const escaped = p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      const re = new RegExp("^" + escaped + "$");
      return re.test(path);
    }
    return path === p;
  });
}

// 단순 추정: chars/3 (영어 4, 한글 2 평균 + 보수적 마진)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

export interface TruncateResult {
  text: string;
  truncated: boolean;
  originalTokens: number;
}

export function truncateToBudget(diff: string, budgetTokens: number): TruncateResult {
  const originalTokens = estimateTokens(diff);
  if (originalTokens <= budgetTokens) {
    return { text: diff, truncated: false, originalTokens };
  }
  const charLimit = budgetTokens * 3;
  return { text: diff.slice(0, charLimit), truncated: true, originalTokens };
}

export function diffToText(files: ParsedFile[]): string {
  return files
    .map((f) => `--- ${f.path} (+${f.additions} -${f.deletions})\n${f.patch ?? "(patch 없음)"}`)
    .join("\n\n");
}
