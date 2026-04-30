import { loadConfig } from "./config/index.js";
import { runPipeline } from "./pipeline/index.js";
import { logger } from "./utils/logger.js";

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

  await runPipeline(config);
  logger.info("=== 완료 ===");
}

main().catch((error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error("실행 실패", { error: msg, stack });
  process.exit(1);
});
