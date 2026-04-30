function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "-");
}

export function vaultEntryPath(username: string, project: string): string {
  return `${sanitize(username)}/${sanitize(project)}.md`;
}

export function userIndexPath(username: string): string {
  return `${sanitize(username)}/README.md`;
}

export const vaultRootReadmePath = "README.md";
