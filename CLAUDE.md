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
- **핫패스** (`src/index.ts` → `src/pipeline/index.ts`): fetch-pr → vault-read(+PR# 멱등 가드) → judge → match → build → vault-init → **결정론 append** 오케스트레이션
  - merge는 더 이상 LLM이 아니다. `src/vault/parser.ts`(parseVault/serializeVault/appendEntry)가 markdown을 결정론적으로 파싱·삽입·정렬·직렬화한다. LLM(build)은 entry 1개만 생성 → 출력이 항상 bounded (잘림 버그 근절)
  - vault write 동시성: `src/vault/writer.ts`의 `updateEntryFile`(applyEdit 재적용 루프)로 stale-clobber 방지. 멱등 키 = entry 메타라인의 `[PR #N]`
- **컴팩션** (주기적 정리, `src/compact.ts` → `src/compaction/index.ts`): vault를 순회하며 카테고리 단위로 중복 entry를 통합. `src/curator/compactor.ts` + `prompts/curator/compactor.md`. 핫패스와 분리 — 실패해도 데이터 무손상. `.github/workflows/compact.yml`(cron)로 실행
- 외부 vault 인증: `TARGET_TOKEN` PAT
- 모델 계단: judge/match는 가벼운 모델(기본 haiku-4.5), builder/compactor는 무거운 모델(기본 sonnet-4.6)
- 비용 가드: `DIFF_TOKEN_BUDGET`(입력 상한, 초과 시 truncated/metadata로 degrade), `MAX_CHANGED_FILES`(거대 PR LLM 호출 전 스킵), `MAX_RUN_COST_USD`(런 누적 비용 백스톱), 컴팩션은 `COMPACT_*`
- Anthropic prompt caching: system prompt + 베스트 프랙티스 .md 에 `cache_control` 적용

## 출력 규약
- vault entry는 4문장 STAR 응축형 (최소 2 / 표준 3 / 최대 4문장)
- 메타 라인 포맷: `[PR #N](url) · YYYY-MM-DD · \`stack1\` \`stack2\``
- 본문은 번호 리스트(1. 2. 3. 4.), 이모지 금지
- 추측 허용 범위: PR 메타에 닿아 있는 합리적 추정 OK, 무에서 만든 할루시네이션 금지
