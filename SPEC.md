# Track Record — Requirement Spec

작성: 2026-04-29 (caracas 워크스페이스, /clarify 결과)
관련 레포: kimzeze/track-record
참조 모델: aptimizer-co/fe-senior-reviewer (reusable workflow + caller template 패턴)

---

## Goal

PR이 merge되는 시점에 reusable GitHub Action이 변경사항을 분석하고, AI가 자율적으로 "이력서감"을 판단해 organization(또는 개인)이 보유한 별도 "이력서 vault 레포"의 `{username}/{project}.md` 파일을 생성·갱신한다.

회사 사람들이 모두 사용 가능하며, organization마다 별도의 vault 레포를 두고 운영할 수 있어야 한다 (개인 작업은 개인 vault로).

---

## Architecture

senior-reviewer와 동일 패턴:

- **Reusable workflow** (`kimzeze/track-record/.github/workflows/curate.yml`)
  - 실제 분석 로직 보유
  - 회사·개인 무관하게 누구나 호출 가능 (`workflow_call`)
- **Caller workflow template** (`caller-templates/track-record-caller.yml`)
  - 각 PR 레포가 복사해 사용
  - PR merge 트리거
- **Track record vault repo**
  - 결과가 push되는 위치
  - caller가 `target_repo` 입력값으로 지정
  - org 작업 → 그 org의 vault (예: `aptimizer-co/track-record-vault`), 개인 작업 → 개인 vault

---

## Inputs (caller가 reusable workflow에 전달)

| Input | 역할 | 필수 | 비고 |
|---|---|---|---|
| `target_repo` | push 대상 vault 레포 (예: `aptimizer-co/track-record-vault`, `kimzeze/my-track-record`) | O | |
| `target_token` | vault repo write 권한 PAT | O | secret |
| `anthropic_api_key` | AI 분석용 | O | secret |

## 자동 결정 (사용자 입력 불필요)

- `person_id`: PR 작성자 GitHub username 자동 사용
- `project_name`: caller repo 이름 자동
- 참조할 베스트 프랙티스 스킬: AI가 PR 변경 파일 보고 자동 매칭
  - 예: `.tsx` 파일 변경 → vercel-react-best-practices, next-best-practices
  - 예: 캐싱 관련 코드 → next-cache-components

---

## Output 구조

```
{target_repo}/
  {username}/
    {project_name}.md       ← 카테고리별 AI 동적 태깅 항목들
```

### md 파일 구조 (예시) — 4문장 STAR 응축형

```markdown
# {project_name}

## Performance > Caching
### Turborepo Remote Cache로 CI 62% 단축
[PR #102](https://github.com/aptimizer-co/my-app/pull/102) · 2026-03-15 · `Turborepo` `GitHub Actions`

모노레포 18 패키지 규모에서 매 push마다 변경 없는 패키지까지 재빌드되며 CI 평균 8분 → 팀 throughput 병목.

Nx 마이그레이션은 도구 전환 비용이 크고 GitHub Actions cache는 task graph 단위 캐싱 미지원이라, 기존 `turbo.json` 자산 재사용 가능한 remote cache 채택.

도입 1주 측정 시 CI 8분 → 3분(62%↓), 캐시 히트율 73%, 팀 머지 throughput 주당 22 → 31건.

빌드 결정성(타임스탬프 제거)이 캐시 안정성의 선결조건임을 첫 주 무효화 사고로 학습.

## DX > Build Tooling
### ...
```

**4문장 STAR 매핑:**
1. **문제** — 상황 + 부족함 (정량 1개 가능 시)
2. **결정** — 대안 + 트레이드오프 ("X 대신 Y")
3. **결과** — 구현 핵심 + 정량 임팩트
4. **학습** *(선택)* — 회고 / 한계 / 후속

**길이 룰**: 최소 2문장, 표준 3문장, 최대 4문장. 절대 5문장 이상 금지.

**메타 라인 포맷**: `[PR #N](url) · YYYY-MM-DD · \`stack1\` \`stack2\``

**추측 허용**: 코드/diff/PR 메타에 닿아 있는 합리적 추정 OK. 무에서 만든 할루시네이션 금지. 정량 수치는 PR/diff/commit에 명시된 것만 인용, 없으면 정성 서술로 대체.

---

## 판단 로직

- **Trigger**: PR `closed` + `merged: true`
- **임계 통과 기준**:
  - 테크니컬 깊이 (베스트 프랙티스 스킬과 매칭, 최신 패턴, 추상화 수준)
  - OR 임팩트 (성능 수치, 사용자 영향, 버그 수정 규모)
  - 둘 중 하나라도 강하면 통과 → 추가, 둘 다 약하면 skip
- **머지 전략**:
  - AI가 기존 항목과 유사도 판단
  - 유사하면 → 기존 항목을 수정·취합 (metric 보강, 사례 추가)
  - 새 주제면 → 새 entry append
- **카테고리**: AI 동적 태깅 (고정 목록 없음, top-level + sub-tag 자유)
- **사람 개입 confirm 단계 없음** (PR 코멘트로 묻지 않음, 임계 넘으면 바로 push)

---

## Out of Scope (이번 라운드)

- 사람 개입 confirm 흐름 (필요 시 v2)
- Notion/Google Docs/외부 DB 동기화
- Slack 알림 (필요 시 optional input으로 추후 추가)
- Privacy 등급 분기 (vault repo의 private/public 여부는 caller 책임으로 위임)

---

## 구현 시작 시 고려할 것

1. **분석 엔진**: senior-reviewer 처럼 Anthropic SDK 직접 호출, 또는 anthropics/claude-code-action 같은 wrapper 활용 검토
2. **베스트 프랙티스 스킬 접근 방법**: 스킬 자체는 사용자 머신의 ~/.claude/skills에 있음. action 환경에선 어떻게 참조할지 — 핵심 가이드를 프롬프트에 inline 임베드 vs 스킬 마크다운을 레포에 복사해두기
3. **vault repo 구조 초기화**: 처음 push 시 README, 폴더 구조 자동 생성
4. **충돌 처리**: 같은 PR이 여러 번 처리되거나, 동시에 여러 PR이 머지될 때 push 충돌 (단순 retry로 충분할 듯)
5. **PR diff 토큰 한도**: 거대 PR의 경우 diff 요약·파일 그룹핑 전략 필요

---

## Decisions Log

| Question | Decision |
|---|---|
| 결과물 저장 위치 | caller가 `target_repo`로 지정, 폴더는 `{username}/{project}.md` 고정 |
| Trigger | PR merge 시점만 |
| 판단 주체 | AI 자율, 임계점수 넘으면 즉시 push |
| 베스트 프랙티스 참조 | AI가 변경 파일 보고 관련 스킬 자동 선택 |
| 카테고리 체계 | AI 동적 태깅 |
| 머지 전략 | AI가 기존 항목과 유사하면 수정·취합, 새 주제면 append |
| 사람 식별자 | PR 작성자 GitHub username 자동 |
| 저장 정보 깊이 | 레포명·PR 번호·diff 요약 모두 보존 |
| 임계 기준 | 테크 깊이 OR 임팩트 — 한쪽이라도 강하면 통과 |
| Entry 형식 | 4문장 STAR 응축형 + 메타 1줄 (최소 2 / 표준 3 / 최대 4문장) |
| 추측 허용 | PR 메타에 닿아 있는 합리적 추정 OK, 무에서 만든 할루시네이션 금지 |
| 베스트 프랙티스 시작 셋 | `prompts/stacks/vercel-react-best-practices.md` 1개 (관찰 후 확장) |
| vault repo 초기화 | 첫 push 시 README + 폴더 + 사람별 인덱스 자동 생성 |
| 거대 PR 토큰 전략 | 토큰 예산 80k 기본 + 4단계 폴백 (정상 → 메타데이터 모드 → skip) |
| vault 인증 | PAT 단일 옵션 (`TARGET_TOKEN` secret) |
| 모델 계단 | judge=haiku-4.5, builder/merger=sonnet-4.6 (caller가 `model_judge`/`model_builder` input으로 오버라이드 가능) |
| Anthropic prompt caching | system prompt + 베스트 프랙티스 마크다운에 cache_control 적용 |
| senior-reviewer와 관계 | 독립 레포 유지 (트리거·출력·관점·권한 모두 다름, 합쳐도 비용 절감 없음) |
