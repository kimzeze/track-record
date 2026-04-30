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

  targetRepoPath: string;

  slackWebhookUrl?: string;
}
