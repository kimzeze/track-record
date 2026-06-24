import { getAnthropic } from "../anthropic/client.js";
import type { UsageTracker } from "../anthropic/usage.js";
import type { Config } from "../config/types.js";
import { buildEntry } from "../curator/entry-builder.js";
import { matchSkills } from "../curator/skill-matcher.js";
import { judgeThreshold, type ThresholdJudgement } from "../curator/threshold-judge.js";
import { getOctokit } from "../github/client.js";
import { fetchPRContext } from "../github/pr-context.js";
import { sendSlackPass, sendSlackSkip } from "../slack/client.js";
import { logger } from "../utils/logger.js";
import { getVaultRepo } from "../vault/client.js";
import { ensureRootReadme, ensureUserIndex } from "../vault/initializer.js";
import { appendEntry, isRecorded, parseVault, serializeVault } from "../vault/parser.js";
import { vaultEntryPath } from "../vault/path-resolver.js";
import { readEntryFile } from "../vault/reader.js";
import { updateEntryFile } from "../vault/writer.js";
import { attachStage, type Stage } from "./stages.js";

export async function runPipeline(config: Config, tracker: UsageTracker): Promise<void> {
  const anthropic = getAnthropic(config.anthropicApiKey);
  const octokit = getOctokit(config.githubToken);
  const vault = getVaultRepo(config.targetRepo, config.targetToken);

  const assertBudget = (next: Stage) => {
    const spent = tracker.total().costUsd;
    if (spent > config.maxRunCostUsd) {
      throw new Error(
        `비용 상한 초과: $${spent.toFixed(4)} > $${config.maxRunCostUsd} — ${next} 단계 중단`,
      );
    }
  };

  let stage: Stage = "init";
  try {
    stage = "fetch-pr";
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

    // 비용 보호: 비정상적으로 거대한 PR(생성코드·vendor 덤프 등)은 LLM 호출 전에 차단
    if (pr.changedFilesCount > config.maxChangedFiles) {
      const reason = `변경 파일 ${pr.changedFilesCount}개 > 상한 ${config.maxChangedFiles} — 비용 보호 위해 분석 생략`;
      logger.info("거대 PR → SKIP", { files: pr.changedFilesCount });
      if (config.slackWebhookUrl) {
        const judgement: ThresholdJudgement = { pass: false, category: "neither", reason };
        await sendSlackSkip(config.slackWebhookUrl, pr, judgement, config.repoName, tracker.total());
      }
      return;
    }

    stage = "vault-read";
    const path = vaultEntryPath(pr.author, config.repoName);
    const existing = await readEntryFile(vault, path);
    logger.info("기존 entry 조회", { exists: existing.exists, path });

    // 멱등: 이미 적립된 PR(Action 재실행/중복 트리거)은 LLM 한 번도 안 돌리고 종료
    if (existing.exists && isRecorded(existing.content, pr.number)) {
      logger.info("이미 적립된 PR → SKIP (멱등)", { pr: pr.number });
      return;
    }

    stage = "judge";
    const judgement = await judgeThreshold(anthropic, config.modelJudge, pr, tracker);
    logger.info("threshold judgement", judgement);
    if (!judgement.pass) {
      logger.info("임계 미달 → SKIP");
      if (config.slackWebhookUrl) {
        await sendSlackSkip(config.slackWebhookUrl, pr, judgement, config.repoName, tracker.total());
      }
      return;
    }

    assertBudget("match");
    stage = "match";
    const { skills } = await matchSkills(anthropic, config.modelJudge, pr, tracker);
    logger.info("skill match", { skills });

    assertBudget("build");
    stage = "build";
    const entry = await buildEntry(anthropic, config.modelBuilder, pr, skills, tracker);
    logger.info("entry built", { category: entry.category, headline: entry.headline });

    stage = "vault-init";
    await ensureRootReadme(vault);
    await ensureUserIndex(vault, pr.author);

    stage = "vault-append";
    const prDate = pr.mergedAt ? pr.mergedAt.slice(0, 10) : "";
    const result = await updateEntryFile(vault, {
      path,
      message: `track: ${pr.author}/${config.repoName} — PR #${pr.number} ${entry.category}`,
      initial: { content: existing.content, sha: existing.sha },
      apply: (current) => {
        if (current.content && isRecorded(current.content, pr.number)) return null;
        const doc = parseVault(current.content);
        if (!doc.title) doc.title = config.repoName;
        appendEntry(doc, entry, pr.number, prDate);
        return serializeVault(doc);
      },
    });

    if (!result.written) {
      logger.info("동시 실행이 먼저 적립함 → write 생략 (멱등)", { pr: pr.number });
      return;
    }
    logger.info("vault append 완료", { path });

    stage = "slack-pass";
    if (config.slackWebhookUrl) {
      await sendSlackPass(
        config.slackWebhookUrl,
        pr,
        entry,
        config.targetRepo,
        config.repoName,
        tracker.total(),
      );
    }

    logger.info("usage totals", { ...tracker.total() } as Record<string, unknown>);
  } catch (e: unknown) {
    throw attachStage(e, stage);
  }
}
