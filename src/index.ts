import { UsageTracker } from "./anthropic/usage.js";
import { loadConfig } from "./config/index.js";
import { runPipeline } from "./pipeline/index.js";
import { getStage } from "./pipeline/stages.js";
import { sendSlackFail } from "./slack/client.js";
import { logger } from "./utils/logger.js";

const tracker = new UsageTracker();

function buildRunUrl(): string | undefined {
  const server = process.env.GITHUB_SERVER_URL;
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (!server || !repo || !runId) return undefined;
  return `${server}/${repo}/actions/runs/${runId}`;
}

function buildPrUrl(repo: string | undefined, prNumber: number | undefined): string | undefined {
  if (!repo || !prNumber) return undefined;
  const server = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  return `${server}/${repo}/pull/${prNumber}`;
}

async function notifyFail(error: unknown): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const repo =
    process.env.GITHUB_REPOSITORY ??
    (process.env.REPO_OWNER && process.env.REPO_NAME
      ? `${process.env.REPO_OWNER}/${process.env.REPO_NAME}`
      : undefined);
  const prNumberRaw = process.env.PR_NUMBER;
  const prNumber = prNumberRaw ? parseInt(prNumberRaw, 10) : undefined;
  const stage = getStage(error);
  const errorMessage = error instanceof Error ? error.message : String(error);

  await sendSlackFail(webhookUrl, {
    repo: repo ?? "(unknown)",
    prNumber: Number.isFinite(prNumber) ? prNumber : undefined,
    prUrl: buildPrUrl(repo, prNumber),
    stage,
    errorMessage,
    runUrl: buildRunUrl(),
    totals: tracker.total(),
  });
}

async function main() {
  const config = loadConfig();
  logger.info("track-record 시작", {
    repo: `${config.repoOwner}/${config.repoName}`,
    pr: config.prNumber,
    target: config.targetRepo,
    modelJudge: config.modelJudge,
    modelBuilder: config.modelBuilder,
    diffTokenBudget: config.diffTokenBudget,
    excludeCount: config.excludePatterns.length,
  });

  await runPipeline(config, tracker);
  logger.info("=== 완료 ===");
}

main().catch(async (error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error("실행 실패", { error: msg, stage: getStage(error), stack });
  await notifyFail(error);
  process.exit(1);
});
