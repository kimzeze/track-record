export interface Config {
  githubToken: string;
  repoOwner: string;
  repoName: string;
  prNumber: number;

  anthropicApiKey: string;
  modelJudge: string;
  modelBuilder: string;

  targetRepo: string;
  targetToken: string;

  diffTokenBudget: number;
  excludePatterns: string[];

  maxChangedFiles: number;
  maxRunCostUsd: number;

  targetRepoPath: string;

  slackWebhookUrl?: string;
}

export interface CompactionConfig {
  anthropicApiKey: string;
  targetRepo: string;
  targetToken: string;
  modelCompactor: string;

  minEntries: number;
  maxEntriesPerCategory: number;
  maxFileTokens: number;
  maxRunCostUsd: number;
  maxOutputTokens: number;

  slackWebhookUrl?: string;
}
