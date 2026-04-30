import type { VaultRepo } from "./client.js";

export interface VaultWriteOptions {
  path: string;
  content: string;
  message: string;
  sha?: string;
}

export async function writeEntryFile(vault: VaultRepo, opts: VaultWriteOptions): Promise<void> {
  let currentSha = opts.sha;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await vault.octokit.repos.createOrUpdateFileContents({
        owner: vault.owner,
        repo: vault.repo,
        path: opts.path,
        message: opts.message,
        content: Buffer.from(opts.content, "utf8").toString("base64"),
        sha: currentSha,
      });
      return;
    } catch (e: unknown) {
      if (!isConflict(e) || attempt === 2) {
        throw e;
      }
      // 충돌 시 최신 sha로 갱신 후 재시도
      const latest = await fetchLatestSha(vault, opts.path);
      currentSha = latest;
    }
  }
}

async function fetchLatestSha(vault: VaultRepo, path: string): Promise<string | undefined> {
  try {
    const { data } = await vault.octokit.repos.getContent({
      owner: vault.owner,
      repo: vault.repo,
      path,
    });
    if (!Array.isArray(data) && data.type === "file") {
      return data.sha;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function isConflict(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    [409, 422].includes((e as { status: number }).status)
  );
}
