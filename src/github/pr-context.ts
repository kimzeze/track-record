import type { Octokit } from "@octokit/rest";
import {
  diffToText,
  estimateTokens,
  isExcluded,
  prioritizeFiles,
  type ParsedDiff,
  type ParsedFile,
} from "./diff-parser.js";

export type PRMode = "full" | "truncated" | "metadata-only" | "skip";

export interface PRContext {
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string;
  author: string;
  url: string;
  mergedAt: string;

  additions: number;
  deletions: number;
  changedFilesCount: number;

  parsedDiff: ParsedDiff;
  commitMessages: string[];

  mode: PRMode;
  diffTokens: number;
  patchIncludedCount: number;
  patchOmittedCount: number;
}

export async function fetchPRContext(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  excludePatterns: string[],
  budgetTokens: number,
): Promise<PRContext> {
  const { data: pr } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  const files = await octokit.paginate(octokit.pulls.listFiles, {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  const filtered = files.filter((f) => !isExcluded(f.filename, excludePatterns));

  const parsedFiles: ParsedFile[] = filtered.map((f) => ({
    path: f.filename,
    status: f.status as ParsedFile["status"],
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));

  const commits = await octokit.paginate(octokit.pulls.listCommits, {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  const commitMessages = commits.map((c) => c.commit.message);

  const fullDiffTokens = estimateTokens(diffToText(parsedFiles));

  let mode: PRMode;
  let finalFiles: ParsedFile[];
  let includedCount: number;
  let omittedCount: number;

  if (fullDiffTokens <= budgetTokens) {
    mode = "full";
    finalFiles = parsedFiles;
    includedCount = parsedFiles.filter((f) => f.patch).length;
    omittedCount = 0;
  } else {
    const prioritized = prioritizeFiles(parsedFiles, budgetTokens);
    if (prioritized.includedCount === 0) {
      // 헤더만으로도 예산 초과 — patch 전부 제거
      mode = "metadata-only";
      finalFiles = parsedFiles.map((f) => ({ ...f, patch: undefined, patchOmitted: true }));
      includedCount = 0;
      omittedCount = parsedFiles.filter((f) => f.patch).length;
    } else {
      mode = "truncated";
      finalFiles = prioritized.files;
      includedCount = prioritized.includedCount;
      omittedCount = prioritized.excludedCount;
    }
  }

  return {
    owner,
    repo,
    number: prNumber,
    title: pr.title,
    body: pr.body ?? "",
    author: pr.user?.login ?? "unknown",
    url: pr.html_url,
    mergedAt: pr.merged_at ?? "",
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    changedFilesCount: parsedFiles.length,
    parsedDiff: {
      files: finalFiles,
      totalAdditions: parsedFiles.reduce((a, f) => a + f.additions, 0),
      totalDeletions: parsedFiles.reduce((a, f) => a + f.deletions, 0),
    },
    commitMessages,
    mode,
    diffTokens: fullDiffTokens,
    patchIncludedCount: includedCount,
    patchOmittedCount: omittedCount,
  };
}
