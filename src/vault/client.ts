import { Octokit } from "@octokit/rest";

export interface VaultRepo {
  octokit: Octokit;
  owner: string;
  repo: string;
}

export function getVaultRepo(targetRepo: string, token: string): VaultRepo {
  const [owner, repo] = targetRepo.split("/");
  if (!owner || !repo) {
    throw new Error(`TARGET_REPO 형식 오류 (owner/repo 필요): ${targetRepo}`);
  }
  return {
    octokit: new Octokit({ auth: token }),
    owner,
    repo,
  };
}
