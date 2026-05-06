export const STAGES = [
  "init",
  "fetch-pr",
  "judge",
  "match",
  "build",
  "vault-init",
  "vault-read",
  "merge",
  "vault-write",
  "slack-pass",
] as const;

export type Stage = (typeof STAGES)[number];

export interface StagedError extends Error {
  stage?: Stage;
}

export function attachStage(error: unknown, stage: Stage): StagedError {
  const err =
    error instanceof Error ? (error as StagedError) : (new Error(String(error)) as StagedError);
  err.stage = stage;
  return err;
}

export function getStage(error: unknown): Stage | "unknown" {
  if (error && typeof error === "object" && "stage" in error) {
    const stage = (error as StagedError).stage;
    if (stage && STAGES.includes(stage)) return stage;
  }
  return "unknown";
}
