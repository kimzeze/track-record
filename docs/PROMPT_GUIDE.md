# 프롬프트 가이드

`prompts/` 안의 마크다운은 AI 동작에 직접 영향한다. 변경 전·후 dry-run 검증을 권장.

## 디렉토리

```
prompts/
├── curator/
│   ├── threshold-judge.md     # 1차 통과/skip 판정
│   ├── skill-matcher.md       # 변경 파일 → 베스트 프랙티스 매칭
│   ├── entry-builder.md       # 4문장 STAR entry 작성
│   └── entry-merger.md        # 기존 .md와 머지/append 결정
└── stacks/
    └── vercel-react-best-practices.md   # entry-builder 단계 참조
```

## TS 핸들러와의 매핑

| 프롬프트 | 핸들러 | 모델(기본) |
|---|---|---|
| `curator/threshold-judge.md` | `src/curator/threshold-judge.ts` | judge (haiku-4.5) |
| `curator/skill-matcher.md` | `src/curator/skill-matcher.ts` | judge (haiku-4.5) |
| `curator/entry-builder.md` | `src/curator/entry-builder.ts` | builder (sonnet-4.6) |
| `curator/entry-merger.md` | `src/curator/entry-merger.ts` | builder (sonnet-4.6) |
| `stacks/{name}.md` | `entry-builder` 의 system blocks 에 inline 임베드 | — |

## 출력 규약 (4단계 모두 공통)

**JSON only.** 코드펜스(\`\`\`json ... \`\`\`)는 허용, 그 외 산문 금지. zod 스키마 위반 시 throw.

각 프롬프트의 마지막 섹션에 출력 JSON 예시가 있다. 스키마 정확성을 유지하라.

## 프롬프트 캐싱

`src/anthropic/client.ts` 의 `buildCachedSystem` 이 system blocks 의 **마지막 블록에만** `cache_control: { type: "ephemeral" }` 를 박는다. Anthropic이 입력 토큰을 ~90% 할인.

`entry-builder` 는 system 에 `entry-builder.md` + 매칭된 stacks/*.md 를 순서대로 넣는데, 마지막 stack 이 캐시 대상. 같은 PR에 같은 스킬 셋이면 후속 호출(머지 등)에서 캐시 히트.

## 변경 권장 절차

1. 프롬프트 수정
2. `pnpm test` 통과 (단위 테스트는 zod 스키마 의존이라 출력 JSON 형태 변경 시 zod 스키마도 갱신)
3. (옵션) `fixtures/` 의 mock PR 으로 dry-run — 실 API 호출
4. PR — diff에 변경 의도와 검증 방법 명시

## 새 베스트 프랙티스 추가

1. `prompts/stacks/{name}.md` 작성. 구조는 vercel-react-best-practices 참고:
   - 핵심 원칙
   - 흔한 안티패턴
   - entry 작성 시 활용 (어휘·관점)
2. `prompts/curator/skill-matcher.md` 의 "사용 가능한 스킬" 항목에 새 이름·매칭 시그널 추가
3. `pnpm test && pnpm build` 검증
