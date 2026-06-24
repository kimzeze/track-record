import { z, ZodError } from "zod";
import type { CompactionConfig, Config } from "./types.js";

const envSchema = z.object({
  GITHUB_TOKEN: z.string().min(1),
  REPO_OWNER: z.string().min(1),
  REPO_NAME: z.string().min(1),
  PR_NUMBER: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  MODEL_JUDGE: z.string().default("claude-haiku-4-5"),
  MODEL_BUILDER: z.string().default("claude-sonnet-4-6"),
  TARGET_REPO: z.string().regex(/^[^/]+\/[^/]+$/, "owner/repo 형식이어야 함"),
  TARGET_TOKEN: z.string().min(1),
  DIFF_TOKEN_BUDGET: z.string().default("80000"),
  EXCLUDE_PATTERNS: z.string().default(""),
  MAX_CHANGED_FILES: z.string().default("400"),
  MAX_RUN_COST_USD: z.string().default("0.5"),
  TARGET_REPO_PATH: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().optional(),
});

export function loadConfig(): Config {
  let env: z.infer<typeof envSchema>;
  try {
    env = envSchema.parse(process.env);
  } catch (e) {
    if (e instanceof ZodError) {
      const issues = e.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join("; ");
      throw new Error(`환경변수 검증 실패 — ${issues}`);
    }
    throw e;
  }
  return {
    githubToken: env.GITHUB_TOKEN,
    repoOwner: env.REPO_OWNER,
    repoName: env.REPO_NAME,
    prNumber: parseInt(env.PR_NUMBER, 10),
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    modelJudge: env.MODEL_JUDGE,
    modelBuilder: env.MODEL_BUILDER,
    targetRepo: env.TARGET_REPO,
    targetToken: env.TARGET_TOKEN,
    diffTokenBudget: parseInt(env.DIFF_TOKEN_BUDGET, 10),
    excludePatterns: env.EXCLUDE_PATTERNS.split(",").map((s) => s.trim()).filter(Boolean),
    maxChangedFiles: parseInt(env.MAX_CHANGED_FILES, 10),
    maxRunCostUsd: Number.parseFloat(env.MAX_RUN_COST_USD),
    targetRepoPath: env.TARGET_REPO_PATH ?? process.cwd(),
    slackWebhookUrl: env.SLACK_WEBHOOK_URL || undefined,
  };
}

const compactionEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  TARGET_REPO: z.string().regex(/^[^/]+\/[^/]+$/, "owner/repo 형식이어야 함"),
  TARGET_TOKEN: z.string().min(1),
  MODEL_COMPACTOR: z.string().default("claude-sonnet-4-6"),
  COMPACT_MIN_ENTRIES: z.string().default("6"),
  COMPACT_MAX_ENTRIES_PER_CATEGORY: z.string().default("30"),
  COMPACT_MAX_FILE_TOKENS: z.string().default("30000"),
  COMPACT_MAX_RUN_COST_USD: z.string().default("3"),
  COMPACT_MAX_OUTPUT_TOKENS: z.string().default("4096"),
  SLACK_WEBHOOK_URL: z.string().optional(),
});

export function loadCompactionConfig(): CompactionConfig {
  let env: z.infer<typeof compactionEnvSchema>;
  try {
    env = compactionEnvSchema.parse(process.env);
  } catch (e) {
    if (e instanceof ZodError) {
      const issues = e.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("; ");
      throw new Error(`환경변수 검증 실패 — ${issues}`);
    }
    throw e;
  }
  return {
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    targetRepo: env.TARGET_REPO,
    targetToken: env.TARGET_TOKEN,
    modelCompactor: env.MODEL_COMPACTOR,
    minEntries: parseInt(env.COMPACT_MIN_ENTRIES, 10),
    maxEntriesPerCategory: parseInt(env.COMPACT_MAX_ENTRIES_PER_CATEGORY, 10),
    maxFileTokens: parseInt(env.COMPACT_MAX_FILE_TOKENS, 10),
    maxRunCostUsd: Number.parseFloat(env.COMPACT_MAX_RUN_COST_USD),
    maxOutputTokens: parseInt(env.COMPACT_MAX_OUTPUT_TOKENS, 10),
    slackWebhookUrl: env.SLACK_WEBHOOK_URL || undefined,
  };
}
