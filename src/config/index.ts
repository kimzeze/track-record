import { z, ZodError } from "zod";
import type { Config } from "./types.js";

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
    targetRepoPath: env.TARGET_REPO_PATH ?? process.cwd(),
    slackWebhookUrl: env.SLACK_WEBHOOK_URL || undefined,
  };
}
