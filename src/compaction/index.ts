import { getAnthropic } from "../anthropic/client.js";
import type { UsageTracker } from "../anthropic/usage.js";
import type { CompactionConfig } from "../config/types.js";
import { applyMerges, compactCategory } from "../curator/compactor.js";
import { estimateTokens } from "../github/diff-parser.js";
import { logger } from "../utils/logger.js";
import { getVaultRepo, type VaultRepo } from "../vault/client.js";
import { parseVault, serializeVault } from "../vault/parser.js";
import { readEntryFile } from "../vault/reader.js";
import { updateEntryFile } from "../vault/writer.js";

export interface CompactionSummary {
  files: number;
  filesChanged: number;
  categoriesMerged: number;
  skippedLargeFiles: number;
  skippedOversizedCategories: number;
  deferred: number;
  stoppedByCost: boolean;
}

function projectNameFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.md$/, "");
}

// vault 레포의 모든 {user}/{project}.md 경로 (README 제외).
async function listEntryFiles(vault: VaultRepo): Promise<string[]> {
  const repo = await vault.octokit.repos.get({ owner: vault.owner, repo: vault.repo });
  const branch = await vault.octokit.repos.getBranch({
    owner: vault.owner,
    repo: vault.repo,
    branch: repo.data.default_branch,
  });
  const treeSha = branch.data.commit.commit.tree.sha;
  const tree = await vault.octokit.git.getTree({
    owner: vault.owner,
    repo: vault.repo,
    tree_sha: treeSha,
    recursive: "true",
  });

  return tree.data.tree
    .filter((t) => t.type === "blob" && typeof t.path === "string")
    .map((t) => t.path as string)
    .filter((p) => /^[^/]+\/[^/]+\.md$/.test(p) && !p.endsWith("/README.md"));
}

export async function runCompaction(
  config: CompactionConfig,
  tracker: UsageTracker,
): Promise<CompactionSummary> {
  const anthropic = getAnthropic(config.anthropicApiKey);
  const vault = getVaultRepo(config.targetRepo, config.targetToken);

  const summary: CompactionSummary = {
    files: 0,
    filesChanged: 0,
    categoriesMerged: 0,
    skippedLargeFiles: 0,
    skippedOversizedCategories: 0,
    deferred: 0,
    stoppedByCost: false,
  };

  const files = await listEntryFiles(vault);
  summary.files = files.length;
  logger.info("컴팩션 대상 파일", { count: files.length });

  for (const path of files) {
    if (tracker.total().costUsd > config.maxRunCostUsd) {
      logger.warn("비용 상한 도달 → 남은 파일 보류", {
        spent: tracker.total().costUsd,
        cap: config.maxRunCostUsd,
      });
      summary.stoppedByCost = true;
      break;
    }

    const read = await readEntryFile(vault, path);
    if (!read.exists) continue;

    if (estimateTokens(read.content) > config.maxFileTokens) {
      logger.info("파일 토큰 상한 초과 → 스킵", { path });
      summary.skippedLargeFiles += 1;
      continue;
    }

    const doc = parseVault(read.content);
    const projectName = doc.title || projectNameFromPath(path);
    let fileMerged = 0;

    for (const category of doc.categories) {
      if (category.entries.length < config.minEntries) continue;
      if (category.entries.length > config.maxEntriesPerCategory) {
        logger.info("카테고리 entry 수 상한 초과 → 스킵", {
          path,
          category: category.name,
          entries: category.entries.length,
        });
        summary.skippedOversizedCategories += 1;
        continue;
      }
      if (tracker.total().costUsd > config.maxRunCostUsd) {
        summary.stoppedByCost = true;
        break;
      }

      const result = await compactCategory(
        anthropic,
        config.modelCompactor,
        projectName,
        category,
        config.maxOutputTokens,
        tracker,
      );
      const applied = applyMerges(category, result);
      if (applied.changed) {
        fileMerged += applied.mergedGroups;
        logger.info("카테고리 통합", {
          path,
          category: category.name,
          groups: applied.mergedGroups,
        });
      }
    }

    if (fileMerged === 0) continue;

    const newContent = serializeVault(doc);
    const res = await updateEntryFile(vault, {
      path,
      message: `compact: ${path} — ${fileMerged}건 통합`,
      initial: { content: read.content, sha: read.sha },
      // 분석한 베이스가 그대로일 때만 쓴다. 그새 핫패스 append 가 들어왔으면 보류(다음 런 처리) — clobber 방지.
      apply: (cur) => (cur.sha === read.sha ? newContent : null),
    });

    if (res.written) {
      summary.filesChanged += 1;
      summary.categoriesMerged += fileMerged;
    } else {
      logger.info("동시 변경 감지 → 이번 런은 보류", { path });
      summary.deferred += 1;
    }
  }

  return summary;
}
