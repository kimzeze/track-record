# Track Record — Claude Code Guide

## 코딩 원칙
- 한국어 주석 OK, 단 주석 최소화 (코드가 자명하면 주석 불필요)
- 외부 도구 자동 서명(Co-Authored-By, "Generated with X" 등) 절대 금지
- 커밋 메시지·PR 본문·코드 어디에도 AI 생성 표시 금지

## 빌드/검증
- `pnpm typecheck` 통과 필수
- `pnpm build` 성공 필수
- 변경 후 항상 위 두 가지 검증

## 아키텍처
- `src/curator/*` ↔ `prompts/curator/*` 1:1 대응 (TS 핸들러 + 프롬프트 .md 분리)
- `src/pipeline/index.ts` 가 judge → match → build → merge 순서 오케스트레이션
- 외부 vault 인증: `TARGET_TOKEN` PAT
- 모델 계단: judge는 가벼운 모델(기본 haiku-4.5), builder/merger는 무거운 모델(기본 sonnet-4.6)
- Anthropic prompt caching: system prompt + 베스트 프랙티스 .md 에 `cache_control` 적용

## 출력 규약
- vault entry는 4문장 STAR 응축형 (최소 2 / 표준 3 / 최대 4문장)
- 메타 라인 포맷: `[PR #N](url) · YYYY-MM-DD · \`stack1\` \`stack2\``
- 추측 허용 범위: PR 메타에 닿아 있는 합리적 추정 OK, 무에서 만든 할루시네이션 금지
