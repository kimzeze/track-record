# Contributing

## 개발 환경
- Node.js 22+
- pnpm 9+

## 변경 절차
1. branch 생성 (예: `feat/...`, `fix/...`, `docs/...`)
2. 변경 후 `pnpm typecheck && pnpm build` 통과 확인
3. PR 작성 — 변경 의도와 검증 방법 명시

## 프롬프트 변경
`prompts/curator/*.md` 와 `prompts/stacks/*.md` 는 단순 텍스트지만 AI 동작에 직접 영향. 변경 시 `fixtures/` 의 mock PR 로 dry-run 검증 권장.

## 새 베스트 프랙티스 추가
1. `prompts/stacks/{name}.md` 작성
2. `prompts/curator/skill-matcher.md` 의 매칭 규칙에 새 스킬 추가
3. dry-run 으로 매칭 동작 확인
