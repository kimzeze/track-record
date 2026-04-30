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

### md 파일 구조 (예시)

```markdown
# {project_name}

## Performance > React Server Components
- [PR #123] App Router 마이그레이션으로 초기 번들 280KB → 120KB 감축
  - 기술: Next.js RSC, dynamic import
  - diff 요약: ...

## DX > Build Tooling
- ...
```

각 항목 메타: 레포명, PR 번호·URL, diff 요약, 기술 스택 태그, 성과 서술

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
