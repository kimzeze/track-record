import type { VaultRepo } from "./client.js";
import { readEntryFile } from "./reader.js";
import { userIndexPath, vaultRootReadmePath } from "./path-resolver.js";
import { writeEntryFile } from "./writer.js";

const ROOT_README_BODY = `# Track Record Vault

각 사람 폴더 아래에 \`{project}.md\` 형식으로 머지된 PR의 4문장 STAR entry가 누적됩니다.

[track-record](https://github.com/kimzeze/track-record) 가 자동으로 생성·갱신합니다.
`;

function userIndexBody(username: string): string {
  return `# ${username}

이 폴더 안의 \`{project}.md\` 들이 ${username}님의 머지된 PR 기록입니다.
`;
}

export async function ensureRootReadme(vault: VaultRepo): Promise<void> {
  const existing = await readEntryFile(vault, vaultRootReadmePath);
  if (existing.exists) return;
  await writeEntryFile(vault, {
    path: vaultRootReadmePath,
    content: ROOT_README_BODY,
    message: "init: vault root README",
  });
}

export async function ensureUserIndex(vault: VaultRepo, username: string): Promise<void> {
  const path = userIndexPath(username);
  const existing = await readEntryFile(vault, path);
  if (existing.exists) return;
  await writeEntryFile(vault, {
    path,
    content: userIndexBody(username),
    message: `init: ${username} index`,
  });
}
