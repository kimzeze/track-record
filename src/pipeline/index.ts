import { getAnthropic } from "../anthropic/client.js";
import type { Config } from "../config/types.js";
import { buildEntry } from "../curator/entry-builder.js";
import { mergeEntry } from "../curator/entry-merger.js";
import { matchSkills } from "../curator/skill-matcher.js";
import { judgeThreshold } from "../curator/threshold-judge.js";
import { getOctokit } from "../github/client.js";
import { fetchPRContext } from "../github/pr-context.js";
import { logger } from "../utils/logger.js";
import { getVaultRepo } from "../vault/client.js";
import { ensureRootReadme, ensureUserIndex } from "../vault/initializer.js";
import { vaultEntryPath } from "../vault/path-resolver.js";
import { readEntryFile } from "../vault/reader.js";
import { writeEntryFile } from "../vault/writer.js";

export async function runPipeline(config: Config): Promise<void> {
  const anthropic = getAnthropic(config.anthropicApiKey);
  const octokit = getOctokit(config.githubToken);
  const vault = getVaultRepo(config.targetRepo, config.targetToken);

  logger.info("PR 컨텍스트 fetch", {
    repo: `${config.repoOwner}/${config.repoName}`,
    pr: config.prNumber,
  });

  const pr = await fetchPRContext(
    octokit,
    config.repoOwner,
    config.repoName,
    config.prNumber,
    config.excludePatterns,
    config.diffTokenBudget,
  );

  logger.info("PR 정보", {
    title: pr.title,
    author: pr.author,
    files: pr.changedFilesCount,
    additions: pr.additions,
    deletions: pr.deletions,
    diffTokens: pr.diffTokens,
    mode: pr.mode,
  });

  if (pr.parsedDiff.files.length === 0) {
    logger.info("변경 파일 0개 (또는 전부 exclude됨) → SKIP");
    return;
  }

  const judgement = await judgeThreshold(anthropic, config.modelJudge, pr);
  logger.info("threshold judgement", judgement);
  if (!judgement.pass) {
    logger.info("임계 미달 → SKIP");
    return;
  }

  const { skills } = await matchSkills(anthropic, config.modelJudge, pr);
  logger.info("skill match", { skills });

  const entry = await buildEntry(anthropic, config.modelBuilder, pr, skills);
  logger.info("entry built", { category: entry.category, headline: entry.headline });

  await ensureRootReadme(vault);
  await ensureUserIndex(vault, pr.author);

  const path = vaultEntryPath(pr.author, config.repoName);
  const existing = await readEntryFile(vault, path);
  logger.info("기존 entry 조회", { exists: existing.exists, path });

  const decision = await mergeEntry(
    anthropic,
    config.modelBuilder,
    config.repoName,
    existing.content,
    entry,
  );
  logger.info("머지 결정", { action: decision.action, reason: decision.reason });

  const commitMessage = `track: ${pr.author}/${config.repoName} — PR #${pr.number} ${decision.action}`;
  await writeEntryFile(vault, {
    path,
    content: decision.updatedMarkdown,
    message: commitMessage,
    sha: existing.sha,
  });
  logger.info("vault push 완료", { path, action: decision.action });
}
