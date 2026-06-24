import type { VaultRepo } from "./client.js";
import { readEntryFile } from "./reader.js";

export interface VaultWriteOptions {
  path: string;
  content: string;
  message: string;
  sha?: string;
}

// 정적 콘텐츠 단순 쓰기 (initializer 의 README 등). 충돌 시 최신 sha 로 재시도.
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
      const latest = await readEntryFile(vault, opts.path);
      currentSha = latest.sha;
    }
  }
}

export interface VaultCurrent {
  content: string;
  sha?: string;
}

export interface UpdateEntryOptions {
  path: string;
  message: string;
  /** 이미 read 한 최초 상태. apply 의 첫 입력으로 쓰여 불필요한 재read 를 아낀다. */
  initial: VaultCurrent;
  /**
   * 최신 상태를 받아 쓸 내용을 만든다. null 을 반환하면 no-op(쓰지 않음) — 멱등.
   * 충돌 시 writer 가 최신 상태로 재read 해서 다시 호출한다 (stale-content clobber 방지).
   */
  apply: (current: VaultCurrent) => string | null;
}

export interface UpdateResult {
  written: boolean;
}

// read-modify-write. 충돌(409/422) 시 최신 content 를 재read 하고 apply 를 재적용한다.
// apply 가 "연산"(append 등)이라 최신 베이스에 다시 적용해도 안전 → 동시 PR 이 서로를 덮어쓰지 않는다.
export async function updateEntryFile(
  vault: VaultRepo,
  opts: UpdateEntryOptions,
): Promise<UpdateResult> {
  let current = opts.initial;
  for (let attempt = 0; attempt < 5; attempt++) {
    const next = opts.apply(current);
    if (next === null) return { written: false };

    try {
      await vault.octokit.repos.createOrUpdateFileContents({
        owner: vault.owner,
        repo: vault.repo,
        path: opts.path,
        message: opts.message,
        content: Buffer.from(next, "utf8").toString("base64"),
        sha: current.sha,
      });
      return { written: true };
    } catch (e: unknown) {
      if (!isConflict(e) || attempt === 4) {
        throw e;
      }
      const latest = await readEntryFile(vault, opts.path);
      current = { content: latest.content, sha: latest.sha };
    }
  }
  throw new Error("vault write 충돌 재시도 초과");
}

function isConflict(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    [409, 422].includes((e as { status: number }).status)
  );
}
