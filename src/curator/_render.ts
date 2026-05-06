import type { PRContext } from "../github/pr-context.js";

export function renderPRForLLM(pr: PRContext): string {
  const fileList = pr.parsedDiff.files
    .map((f) => `- ${f.path} (+${f.additions} -${f.deletions}, ${f.status})`)
    .join("\n");
  const commits = pr.commitMessages.map((m) => `- ${m.split("\n")[0]}`).join("\n");

  const header = `# PR Title
${pr.title}

# PR Author
${pr.author}

# PR URL
${pr.url}

# Merged At
${pr.mergedAt}

# PR Description
${pr.body || "(빈 description)"}

# 변경 통계
+${pr.additions}/-${pr.deletions}, ${pr.changedFilesCount}개 파일

# 변경 파일 목록
${fileList || "(없음)"}

# Commit Messages
${commits || "(없음)"}
`;

  if (pr.mode === "metadata-only") {
    return `[메타데이터 모드 — diff ${pr.diffTokens} 토큰이 예산 초과로 본문 생략]\n\n${header}`;
  }

  const includedFiles = pr.parsedDiff.files.filter((f) => f.patch);
  const omittedFiles = pr.parsedDiff.files.filter((f) => f.patchOmitted);

  const diff = includedFiles
    .map((f) => `--- ${f.path}\n${f.patch ?? ""}`)
    .join("\n\n");

  if (pr.mode === "truncated") {
    const omittedNote = omittedFiles
      .map((f) => `- ${f.path} (+${f.additions} -${f.deletions})`)
      .join("\n");
    return `${header}
# Diff (truncated — ${pr.patchIncludedCount}/${pr.changedFilesCount} 파일만 patch 포함, 나머지 ${pr.patchOmittedCount}개는 메타데이터만 제공)
${diff}

# Patch 생략된 파일
${omittedNote}
`;
  }

  return `${header}
# Diff
${diff}
`;
}
