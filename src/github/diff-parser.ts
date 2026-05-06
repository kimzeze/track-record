export interface ParsedFile {
  path: string;
  status: "added" | "removed" | "modified" | "renamed" | "changed" | "copied" | "unchanged";
  additions: number;
  deletions: number;
  patch?: string;
  patchOmitted?: boolean;
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

export function diffToText(files: ParsedFile[]): string {
  return files
    .map((f) => `--- ${f.path} (+${f.additions} -${f.deletions})\n${f.patch ?? "(patch 없음)"}`)
    .join("\n\n");
}

export interface PrioritizeResult {
  files: ParsedFile[];
  includedCount: number;
  excludedCount: number;
  fitsBudget: boolean;
}

/**
 * 변경량 큰 파일부터 patch 포함, 토큰 예산 초과되는 파일부터는 patchOmitted=true.
 * 모든 파일이 budget 이하로 들어가면 fitsBudget=true.
 * 결정적: 변경량 desc, 동률은 path asc.
 */
export function prioritizeFiles(files: ParsedFile[], budgetTokens: number): PrioritizeResult {
  const sorted = [...files].sort((a, b) => {
    const changeDiff = b.additions + b.deletions - (a.additions + a.deletions);
    if (changeDiff !== 0) return changeDiff;
    return a.path.localeCompare(b.path);
  });

  let used = 0;
  let includedCount = 0;
  let excludedCount = 0;
  const result: ParsedFile[] = sorted.map((f) => {
    if (!f.patch) {
      return { ...f, patchOmitted: false };
    }
    const cost = estimateTokens(f.patch) + estimateTokens(f.path) + 8;
    if (used + cost <= budgetTokens) {
      used += cost;
      includedCount += 1;
      return { ...f, patchOmitted: false };
    }
    excludedCount += 1;
    return { ...f, patch: undefined, patchOmitted: true };
  });

  // 원래 순서를 유지: input 순서대로 매핑
  const byPath = new Map(result.map((f) => [f.path, f]));
  const ordered = files.map((f) => byPath.get(f.path) ?? f);

  return {
    files: ordered,
    includedCount,
    excludedCount,
    fitsBudget: excludedCount === 0,
  };
}
