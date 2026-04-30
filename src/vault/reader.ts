import type { VaultRepo } from "./client.js";

export interface VaultReadResult {
  exists: boolean;
  content: string;
  sha?: string;
}

export async function readEntryFile(vault: VaultRepo, path: string): Promise<VaultReadResult> {
  try {
    const { data } = await vault.octokit.repos.getContent({
      owner: vault.owner,
      repo: vault.repo,
      path,
    });
    if (Array.isArray(data) || data.type !== "file") {
      throw new Error(`vault path가 파일이 아님: ${path}`);
    }
    const content = Buffer.from(data.content, "base64").toString("utf8");
    return { exists: true, content, sha: data.sha };
  } catch (e: unknown) {
    if (isNotFound(e)) {
      return { exists: false, content: "" };
    }
    throw e;
  }
}

function isNotFound(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    (e as { status: number }).status === 404
  );
}
