# Entry Builder

머지된 PR을 4문장 STAR 응축형 entry로 작성한다.

## 4문장 매핑

1. **문제** — 상황 + 부족함 (정량 1개 가능 시 명시)
2. **결정** — 대안 + 트레이드오프 ("X 대신 Y, 이유는 …")
3. **결과** — 구현 핵심 + 정량 임팩트
4. **학습** *(선택)* — 회고 / 한계 / 후속 액션

## 길이 룰

- 최소 2문장 (문제 + 결과)
- 표준 3문장 (문제 + 결정 + 결과)
- 최대 4문장 (학습 추가)
- **절대 5문장 이상 금지**

## 추측 허용 범위

- PR 메타·diff·commit message에 닿아 있는 합리적 추정 OK (예: PR title이 빈약해도 변경 파일 패턴에서 의도 추론)
- 무에서 만든 할루시네이션 금지
- 정량 수치는 PR/diff/commit에 명시된 것만 인용. 없으면 정성 서술로 대체 (예: "체감 빨라짐", "안정화")

## 카테고리 동적 태깅

`top-level > sub-tag` 형식. 예시:
- Performance > React Server Components
- Performance > Caching
- DX > Build Tooling
- DX > CI/CD
- Quality > Testing
- Quality > Type Safety
- Architecture > State Management
- Architecture > Module Boundaries
- Security > Auth
- Reliability > Error Handling

기존 카테고리에 얽매이지 않고, PR의 본질에 가장 가까운 단어로 자유롭게 태깅하라.

## 헤드라인 작성 룰

1줄. 정량 결과 1개 이상 포함 ("CI 62% 단축", "번들 280KB → 120KB"). 정량 수치 없으면 임팩트 서술 ("App Router 전환으로 SSR 안정화").

## 메타 라인 포맷

```
[PR #{N}]({url}) · {YYYY-MM-DD} · `stack1` `stack2` `stack3`
```

- `YYYY-MM-DD`는 mergedAt에서 추출
- `stack`은 변경 파일·패치에서 추출 (최대 5개, 백틱으로 감쌈)

## 본문 (4문장 STAR) 작성 예시

```
모노레포 18 패키지 규모에서 매 push마다 변경 없는 패키지까지 재빌드되며 CI 평균 8분 → 팀 throughput 병목. Nx 마이그레이션은 도구 전환 비용이 크고 GitHub Actions cache는 task graph 단위 캐싱 미지원이라, 기존 turbo.json 자산 재사용 가능한 remote cache 채택. 도입 1주 측정 시 CI 8분 → 3분(62%↓), 캐시 히트율 73%, 팀 머지 throughput 주당 22 → 31건. 빌드 결정성(타임스탬프 제거)이 캐시 안정성의 선결조건임을 첫 주 무효화 사고로 학습.
```

## 출력 (JSON only)

```json
{
  "category": "Performance > Caching",
  "headline": "Turborepo Remote Cache로 CI 62% 단축",
  "metaLine": "[PR #102](https://github.com/aptimizer-co/my-app/pull/102) · 2026-03-15 · `Turborepo` `GitHub Actions`",
  "body": "모노레포 18 패키지 규모에서… 학습."
}
```

JSON 외 다른 텍스트는 절대 출력하지 마라.
