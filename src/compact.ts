import { UsageTracker } from "./anthropic/usage.js";
import { runCompaction } from "./compaction/index.js";
import { loadCompactionConfig } from "./config/index.js";
import { logger } from "./utils/logger.js";

const tracker = new UsageTracker();

async function main() {
  const config = loadCompactionConfig();
  logger.info("컴팩션 시작", {
    target: config.targetRepo,
    model: config.modelCompactor,
    minEntries: config.minEntries,
    maxRunCostUsd: config.maxRunCostUsd,
  });

  const summary = await runCompaction(config, tracker);

  logger.info("=== 컴팩션 완료 ===", {
    ...summary,
    ...tracker.total(),
  } as Record<string, unknown>);
}

main().catch((error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error("컴팩션 실패", { error: msg, stack });
  process.exit(1);
});
