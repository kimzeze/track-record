# Track Record

PR이 머지될 때마다 AI가 "이력서감"인지 자율 판정해 vault 레포에 4문장 STAR 형식으로 적립하는 reusable GitHub Action.

> **새 레포에 적용**: [`docs/SETUP_GUIDE.md`](./docs/SETUP_GUIDE.md)
> **프롬프트 수정**: [`docs/PROMPT_GUIDE.md`](./docs/PROMPT_GUIDE.md)
> **요구사항·결정사항**: [`SPEC.md`](./SPEC.md)

---

## 흐름

```
PR closed + merged  ─▶  caller workflow  ─▶  curate.yml (reusable)
                                                  │
                                                  ▼
                            ┌────────────────────────────────────┐
                            │ pipeline                            │
                            │  1. PR context fetch               │
                            │  2. threshold-judge (haiku-4.5)    │ ──▶ skip
                            │  3. skill-matcher                  │
                            │  4. entry-builder (sonnet-4.6)     │
                            │  5. vault root README + user index │
                            │  6. 기존 .md 읽기                  │
                            │  7. entry-merger                   │
                            │  8. vault push (충돌 retry)        │
                            └────────────────────────────────────┘
                                                  │
                                                  ▼
                              {target_repo}/{username}/{project}.md
```

## 출력 예시

`aptimizer-co/track-record-vault/kimzeze/my-app.md`:

```markdown
# my-app

## Performance > Caching
### Turborepo Remote Cache로 CI 62% 단축
[PR #102](https://github.com/aptimizer-co/my-app/pull/102) · 2026-03-15 · `Turborepo` `GitHub Actions`

모노레포 18 패키지 규모에서 매 push마다 변경 없는 패키지까지 재빌드되며 CI 평균 8분 → 팀 throughput 병목. Nx 마이그레이션은 도구 전환 비용이 크고 GitHub Actions cache는 task graph 단위 캐싱 미지원이라, 기존 turbo.json 자산 재사용 가능한 remote cache 채택. 도입 1주 측정 시 CI 8분 → 3분(62%↓), 캐시 히트율 73%, 팀 머지 throughput 주당 22 → 31건. 빌드 결정성(타임스탬프 제거)이 캐시 안정성의 선결조건임을 첫 주 무효화 사고로 학습.
```

4문장 STAR(문제 · 결정 · 결과 · 학습)로 응축. PR URL은 메타 라인에 살아 있어 원본 컨텍스트는 언제든 추적 가능.

## 핵심 결정

| 항목 | 결정 |
|---|---|
| 트리거 | PR `closed` + `merged: true` |
| 출력 위치 | `{target_repo}/{username}/{project}.md` |
| 카테고리 체계 | AI 동적 태깅 (`top-level > sub-tag` 자유) |
| 임계 기준 | 테크 깊이 OR 임팩트 — 한쪽이라도 강하면 통과 |
| Entry 형식 | 4문장 STAR (최소 2 / 표준 3 / 최대 4) + 메타 1줄 |
| 머지 전략 | AI가 기존 항목과 유사도 판단 → 보강 or append |
| 모델 계단 | judge=haiku-4.5, builder=sonnet-4.6 (caller 오버라이드 가능) |
| 거대 PR | 토큰 예산 초과 시 메타데이터 모드 폴백 |
| 인증 | PAT (`TARGET_TOKEN` secret) |
| 사람 개입 | 없음 (PR 코멘트 묻지 않음) |

상세는 [SPEC.md](./SPEC.md).

## 빠른 시작

[docs/SETUP_GUIDE.md](./docs/SETUP_GUIDE.md) 참고. 요약:

1. vault 레포 만들기
2. vault용 PAT 발급
3. Anthropic API key 발급
4. 대상 레포에 [`caller-templates/track-record-caller.yml`](./caller-templates/track-record-caller.yml) 복사
5. `ANTHROPIC_API_KEY`, `TARGET_TOKEN` secret 등록
6. PR 머지 → vault에 적립 자동 시작

## 개발

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm test
```

코드 규약·기여 절차: [CONTRIBUTING.md](./CONTRIBUTING.md). AI 가이드: [CLAUDE.md](./CLAUDE.md).

## 참조

[`aptimizer-co/fe-senior-reviewer`](https://github.com/aptimizer-co/fe-senior-reviewer) 의 reusable workflow + caller template 패턴을 따름.
