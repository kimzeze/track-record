# Backend Roadmap

Track Record를 백엔드(Python Django/DRF 우선 → Spring → Go) 에서도 활용 가능하게 만들고, 동시에 새 스택 추가·멀티 조직·큐레이터 플러그인화 측면에서 확장성을 끌어올리기 위한 작업 계획.

> 이 문서는 "내가 직접 PR을 떼서 작업할 수 있도록" 단계별 체크리스트 형태로 정리한 권장안이다. 합의 후 Phase 1부터 PR 단위로 진행.

---

## 1. 현재 구조 진단

### 1-1. 잘 설계된 부분 (이미 확장 친화적)

- `prompts/curator/*.md` ↔ `src/curator/*.ts` **1:1 대응 구조** — 단계별로 핸들러와 프롬프트가 깔끔히 분리됨
- `prompts/stacks/{name}.md` 디렉토리가 별도로 분리되어 있고, `_prompts.ts` 의 `stack(name)` 헬퍼로 동적 로드 가능
- `src/pipeline/index.ts`가 stage tracking 으로 단계 경계를 명시 — 단계 추가/교체 시 변경 지점이 명확
- `excludePatterns`, `diffTokenBudget`, `modelJudge`, `modelBuilder` 모두 caller workflow input 으로 외부화됨
- vault writer/reader 가 octokit wrapper 로 추상화되어 있음 — 출력 destination 추가 시 wrapper 추가로 대응 가능

### 1-2. 프론트엔드 편향 지점 (수정 필요)

| # | 위치 | 현재 상태 | 백엔드 적용 시 문제 |
|---|---|---|---|
| A | `prompts/stacks/` | `vercel-react-best-practices.md` 1개뿐 | 백엔드 PR이 Skill Matcher 에서 매칭될 스킬 없음 → entry-builder 가 백엔드 도메인 어휘 없이 작성 |
| B | `prompts/curator/skill-matcher.md` | "사용 가능한 스킬" 섹션에 React 1개만 텍스트로 하드코딩 | 새 스택 추가할 때마다 매번 이 파일 수정해야 — N개 스택이 되면 휴먼 에러 / 매칭 우선순위 모호 |
| C | `prompts/curator/entry-builder.md` 카테고리 예시 | `Performance > React Server Components`, `DX > Build Tooling` 등 프론트 편향 | LLM이 백엔드 PR도 프론트 어휘로 강제 분류할 가능성 (예: "API 응답시간 개선" → "Performance > React Server Components" 같은 오분류) |
| D | `prompts/curator/threshold-judge.md` 예시 reason | "App Router 전환으로 RSC 패턴 도입 + 번들 60% 감축" | judge 가 "번들 절감" 같은 프론트 수치 패턴에 anchoring 될 수 있음 |
| E | README 권장 `exclude_patterns` | `pnpm-lock.yaml,*.test.ts,*.test.tsx,*.snap` | Python/Spring/Go 프로젝트엔 무의미 — 새 스택마다 적절한 기본값 부재 |
| F | `caller-templates/track-record-caller.yml` | 프론트 가정 | 백엔드 레포가 복사할 때 exclude 패턴·branch 명을 수동 조정해야 |
| G | `vercel-react-best-practices` 스킬명 | 벤더(Vercel) + 프레임워크(React) 가 섞인 명명 | 새 스택 추가 시 명명 규칙 불명확 (`vercel-react` vs `react` vs `nextjs-app-router`) — 컨벤션 수립 필요 |

### 1-3. 멀티 조직 관점 진단

현재도 caller workflow 단위로 N개 조직이 reusable 을 호출하는 건 **이미 가능**하다. 단,

- 조직마다 다른 `target_repo`(vault) 는 input 으로 처리 가능 — OK
- 조직마다 다른 **judge 기준 / 카테고리 어휘 / 베스트 프랙티스 셋** 은 현재 단일 `prompts/curator/*.md` 를 공유하므로 불가능
- 조직마다 다른 모델·예산도 input 으로 가능하지만, **조직별 프롬프트 오버라이드 경로**가 없음

→ "조직 A는 트래픽 수치 중시, B는 아키텍처 결정 중시" 같은 차별화를 못 함. 확장성 개선 Phase 4 에서 다룸.

---

## 2. 백엔드 적용 단계별 작업

> 각 Phase 는 독립 PR 단위. Phase 1만 완료해도 Django 레포에 적용 가능한 MVP.

### Phase 1 — Django/DRF MVP (가장 우선)

**목적**: Django/DRF 레포 한 곳에 caller 를 붙여서 실제 PR 머지로 entry 가 생성되는지 검증.

**작업**:

- [x] `prompts/stacks/python-django-drf.md` 신규 작성
  - 핵심 원칙 섹션: ORM N+1 회피 (`select_related`/`prefetch_related`), DRF Serializer 책임 분리, `@transaction.atomic` 경계, Django Signals 남용 안티패턴, Cache 계층 (low-level / per-view / template fragment), Celery 비동기 작업 경계, Migration 안전성 (deferred index, schema-vs-data migration 분리)
  - 흔한 안티패턴 섹션: fat view, queryset 을 view 마다 재구성, ORM 호출 in template, Signal 로 비즈니스 로직, n+1 in serializer
  - entry 작성 시 활용 섹션: 위 어휘를 STAR 본문의 "결정" 문장에 자연스럽게 녹이는 가이드
- [x] `prompts/curator/skill-matcher.md` 의 "사용 가능한 스킬" 에 `python-django-drf` 항목 추가
  - 매칭 시그널: `*.py`, `models.py`, `views.py`, `serializers.py`, `migrations/*.py`, `urls.py`, `settings.py`, `requirements*.txt`, `pyproject.toml`, DRF `ViewSet`/`Serializer`/`@action` 문자열
- [x] `prompts/curator/entry-builder.md` 카테고리 예시 보강 — 백엔드 도메인 추가
  - `Performance > Query Optimization`, `Performance > Caching` (백엔드 관점), `Architecture > Service Layer`, `Architecture > Domain Boundary`, `Reliability > Idempotency`, `Reliability > Migration Safety`, `Security > AuthZ`, `Quality > Contract Testing`
- [x] `prompts/curator/threshold-judge.md` 의 "테크 깊이/임팩트" 예시에 백엔드 케이스 한두 줄 추가 (예: "N+1 제거로 list endpoint p95 320ms → 90ms", "schema-vs-data migration 분리로 무중단 적용")
- [ ] `caller-templates/track-record-caller-python.yml` 신규 — Django 레포가 복사할 변종
  - `exclude_patterns` 기본값: `poetry.lock,Pipfile.lock,*_test.py,tests/**,conftest.py,migrations/*.py` (단, migration 자체를 평가 대상에 넣고 싶으면 빼야 — 주석으로 명시)
  - 트리거 branch: 조직 컨벤션 따라 `dev` 또는 `main`
- [ ] 단위 테스트 추가
  - `prioritizeFiles` 가 Python 파일 패턴에서도 결정적인지 (`__init__.py` 동순위 시 path asc 정렬)
  - `diff-parser` 토큰 추정에 Python 키워드가 영향 없는지 (현재 char 단위 추정이라 영향 없음 — 확인만)
- [ ] `pnpm typecheck && pnpm build && pnpm test` 통과
- [ ] 실제 Django 레포 1곳에 caller 추가 → PR 1건 머지로 e2e 검증
  - PASS 케이스 1개 (의미 있는 변경)
  - SKIP 케이스 1개 (lint/typo)
  - 생성된 entry 가 STAR 4문장 형식·메타라인 포맷 통과하는지 육안 검증

**Success criteria**: vault 레포에 `{user}/{django-repo}.md` 가 생성되고, entry 본문이 React 어휘 없이 Django/DRF 도메인 어휘로 작성됨.

---

### Phase 2 — Backend judge/builder 보정 + exclude 프리셋 일반화

**목적**: Phase 1 운영 데이터 1~2주 보고 나서 (PASS 율 / 분류 정확도) 모델/프롬프트 보정.

**작업**:

- [ ] Phase 1 vault entry 10건 이상 누적 후, 다음을 점검
  - 카테고리 오분류율 (백엔드 PR 이 React 카테고리로 태깅되는 비율)
  - SKIP 율이 프론트 대비 너무 높거나 낮은지
  - judge 의 reason 이 백엔드 도메인 어휘로 작성되는지
- [ ] 필요 시 `threshold-judge.md` 의 백엔드 기준 조정 (예: "단순 Django admin tweak"은 SKIP 으로 명시)
- [ ] `exclude_patterns` 프리셋 제안 섹션을 `docs/SETUP_GUIDE.md` 에 스택별 표로 추가
  - Python: `poetry.lock,Pipfile.lock,*_test.py,tests/**,conftest.py`
  - Spring: `*.gradle.lockfile,gradle/wrapper/**,*Test.java,*Test.kt,build/**`
  - Go: `go.sum,vendor/**,*_test.go,testdata/**`
  - JS/TS (기존): `pnpm-lock.yaml,*.test.ts,*.test.tsx,*.snap`
- [ ] 검증 후 머지

---

### Phase 3 — Spring + Go 스택 추가

**목적**: Phase 1 패턴을 그대로 복제해 Spring/Go 도 적용. Phase 1 에서 굳어진 컨벤션 (스킬 명명·매칭 시그널 작성 방식) 을 그대로 따른다.

**작업**:

- [ ] `prompts/stacks/jvm-spring.md` 작성
  - 핵심 원칙: Layered architecture 경계 (Controller/Service/Repository), `@Transactional` 전파/격리 의식, Hibernate N+1 (`@EntityGraph`/`JOIN FETCH`), Bean lifecycle, Spring Security filter chain, Validation (`@Valid` + `@ControllerAdvice`), Reactive (WebFlux) 도입 트레이드오프, Kotlin null safety + data class 활용
  - 매칭 시그널: `*.java`, `*.kt`, `*.kts`, `build.gradle*`, `pom.xml`, `application*.yml`, `application*.properties`, `@RestController`, `@Service`, `@Repository`, `@Entity`
- [ ] `prompts/stacks/go-server.md` 작성
  - 핵심 원칙: context propagation, error wrapping (`%w`), goroutine leak 방지 (channel close + select-default), interface 정의 위치 (caller 측), table-driven test, `sync.Mutex` vs `sync.RWMutex` 선택 기준, structured logging (slog), graceful shutdown
  - 매칭 시그널: `*.go`, `go.mod`, `cmd/**`, `internal/**`, `pkg/**`, `Dockerfile`, `func main()`, `context.Context`, `chan ` 토큰
- [ ] `skill-matcher.md` 에 두 스킬 항목 추가
- [ ] 각 스택별 e2e 1건 검증

---

## 3. 확장성 개선안

> 백엔드 적용이 끝나면 (Phase 1~3) 그 위에 얹는 구조 개선. 우선순위는 4-1 > 4-2 > 4-3.

### 3-1. 새 스택 추가가 쉬워야 함 (Highest priority)

**현재 문제**: 새 스택 추가 시 ① `prompts/stacks/{name}.md` 작성 ② `skill-matcher.md` 의 "사용 가능한 스킬" 텍스트 섹션을 수동 편집 ③ 매칭 시그널 표기 일관성을 휴먼이 유지 — 3번이 가장 휘발성 높음.

**개선안 A — 스킬 메타데이터 frontmatter (저비용·고효과)**

각 `prompts/stacks/{name}.md` 상단에 frontmatter 추가:

```markdown
---
name: python-django-drf
match:
  paths: ["**/*.py", "**/models.py", "**/serializers.py", "**/migrations/**"]
  patterns: ["@api_view", "ViewSet", "Serializer", "select_related"]
priority: 50
---
# Python Django DRF Best Practices
...
```

- `src/curator/skill-registry.ts` (신규) 가 `prompts/stacks/` 디렉토리를 스캔해 frontmatter 만 추출 → `skill-matcher.md` 에 system prompt 로 동적 주입
- `skill-matcher.md` 의 "사용 가능한 스킬" 섹션은 자동 생성되는 placeholder 만 남김 → 수동 편집 불필요
- 새 스택 추가 = `.md` 하나 떨구면 끝. PR diff 가 1 파일이라 리뷰 비용도 낮음

**개선안 B — Skill Matcher 를 deterministic + LLM 하이브리드로**

현재는 LLM 이 매칭을 전담. 파일 경로 매칭은 **결정론적 prefilter** 로 처리 가능:

1. `src/curator/skill-registry.ts` 가 모든 스택의 `match.paths` glob 으로 1차 후보 추림 (코드 단)
2. LLM 은 후보 중 patch 본문까지 봐서 최종 선정만 (입력 토큰 절감)

→ Phase 1~3 후 운영 데이터로 정밀도 측정 후 도입 결정. 미리 만들 필요 X.

**개선안 C — 스킬 명명 컨벤션 수립**

`vercel-react-best-practices` → 일반 패턴으로 통일:

- 형식: `{language-or-runtime}-{framework-or-stack}` (예: `python-django-drf`, `jvm-spring`, `go-server`, `node-nest`, `js-react`)
- 벤더명(Vercel) 은 제거 — 베스트 프랙티스 출처는 .md 본문에서만 인용
- 단위는 "어느 정도 독립적인 기술 스택"이 한 파일 (Next.js 와 React 를 분리할지 합칠지는 운영하며 판단)

기존 `vercel-react-best-practices.md` 는 후속 PR 에서 `js-react.md` 로 rename + Next.js 부분만 분리하는 것을 권장.

---

### 3-2. 멀티 조직/팀 지원

**현재 가능한 것**: caller 마다 `target_repo` 가 달라서 vault 분리는 OK.

**부족한 것**: 조직별 프롬프트/기준 차별화 불가.

**개선안 — Caller 가 prompts override 디렉토리를 inject 가능하게**

```yaml
# caller workflow
uses: kimzeze/track-record/.github/workflows/curate.yml@main
with:
  target_repo: "org-a/vault"
  prompts_overlay: "https://github.com/org-a/track-record-config/tree/main/prompts"
  # 또는 caller 레포 안의 경로: ".github/track-record-prompts"
```

curate.yml 에서:

1. base prompts (`prompts/curator/*.md`, `prompts/stacks/*.md`) 를 먼저 로드
2. overlay 가 지정되면 동일 경로의 파일을 **덮어쓰기** (없으면 base 유지)
3. `_prompts.ts` 의 `load()` 가 overlay 경로 우선, fallback base 의 순으로 읽음

**시나리오**:

- 조직 A: judge 기준을 트래픽 수치 중시로 커스텀 → `prompts/curator/threshold-judge.md` 만 overlay
- 조직 B: 자체 사내 스택용 `prompts/stacks/org-b-internal-framework.md` 추가 → overlay 디렉토리에 새 파일 추가
- 조직 C: 기본값 그대로 사용 → overlay 미지정

**작업**:

- [ ] `config/types.ts` 에 `promptsOverlay?: string` 추가
- [ ] `curate.yml` 에 `prompts_overlay` input + checkout step 추가
- [ ] `_prompts.ts` 의 `load()` 가 overlay 우선 fallback base 로 동작하도록 수정
- [ ] e2e: overlay 미지정 / 일부 파일만 overlay / 전부 overlay 세 케이스 검증

---

### 3-3. 큐레이터 단계 플러그인화

**현재 문제**: `pipeline/index.ts` 가 4단계를 직접 호출. 새 단계 (예: 보안 리뷰, PII 검출) 끼우려면 코드 수정.

**개선안 — Stage 인터페이스 정의 + 등록 기반 실행**

```typescript
// src/pipeline/stage-contract.ts (신규)
export interface PipelineStage<TIn, TOut> {
  name: string;
  run(ctx: TIn, deps: StageDeps): Promise<TOut>;
}

export interface StageDeps {
  anthropic: Anthropic;
  octokit: Octokit;
  vault: VaultClient;
  config: Config;
  tracker: UsageTracker;
}
```

- 기존 `threshold-judge.ts`, `skill-matcher.ts` 등을 `PipelineStage` 구현체로 리팩토링
- `pipeline/index.ts` 는 stage 배열을 순회하는 generic 실행기로 단순화
- 새 단계 추가 = 새 파일 + stage 배열에 한 줄 추가

**비용**: 작지 않음. 기존 e2e 가 잘 동작하는 시점에 PR 단위로 신중히. **이 작업은 백엔드 적용이 안정화된 뒤로 미룬다.**

---

## 4. 추천 작업 순서 (PR 단위)

| 순서 | PR 제목 (제안) | 영향 범위 | 검증 방법 |
|---|---|---|---|
| 1 | `feat: python-django-drf 스택 추가 + skill-matcher 등록` | prompts/stacks/, skill-matcher.md | typecheck/build/test + 실제 Django 레포 1건 e2e |
| 2 | `feat: entry-builder/judge 백엔드 카테고리·예시 보강` | curator 프롬프트 3종 | Phase 1 vault entry 1~2건 분류 점검 |
| 3 | `feat: 백엔드용 caller 템플릿 + exclude 프리셋 가이드` | caller-templates/, docs/SETUP_GUIDE.md | 문서 변경 |
| 4 | `chore: vercel-react-best-practices → js-react 로 rename + Next.js 분리` *(옵션)* | prompts/stacks/, skill-matcher.md | 기존 entry 가 영향 없는지 확인 |
| 5 | `feat: jvm-spring 스택 추가` | prompts/stacks/, skill-matcher.md | Spring 레포 1건 e2e |
| 6 | `feat: go-server 스택 추가` | prompts/stacks/, skill-matcher.md | Go 레포 1건 e2e |
| 7 | `refactor: 스택 메타데이터 frontmatter + skill-registry` | prompts/stacks/*, src/curator/skill-registry.ts (신규), skill-matcher.md | 단위 테스트 추가 |
| 8 | `feat: prompts_overlay 로 조직별 오버라이드 지원` | curate.yml, config, _prompts.ts | overlay 3 케이스 e2e |
| 9 | `refactor: 큐레이터 단계 플러그인화` *(우선순위 낮음)* | pipeline/, curator/ | 기존 e2e 가 모두 통과 |

**1~3 만으로 Django MVP 완성**. 7 이후는 운영 데이터 보고 결정.

---

## 5. 의사결정 포인트 (PR 들어가기 전 확정 필요)

작업 시작 전 다음을 결정/확인하면 좋다:

1. **첫 적용할 Django 레포는 어디인가?** Phase 1 e2e 검증용. 본인 보유 레포 중 PR 흐름이 활발한 곳 1개 선정.
2. **vault 레포는 기존 거 쓸지 / 새로 만들지?** 기존 React 운영 중인 vault 가 있다면 동일 vault 안에 백엔드 entry 가 같이 쌓여도 OK (사용자/프로젝트별 폴더 분리되어 있음).
3. **`migrations/*.py` 를 평가 대상에 포함할지?** 마이그레이션 안전성은 백엔드의 핵심 시그널 — 포함 권장. 다만 auto-generated migration 노이즈가 많으면 그때 exclude 조정.
4. **Next.js 와 React 를 한 스킬에 둘지 분리할지?** (PR #4 옵션 항목) — 운영하며 entry 가 양쪽에 걸치는 빈도로 판단.
5. **스킬 명명 컨벤션 (`{language}-{framework}`) 에 동의하는지?** 동의하면 rename PR 진행, 아니면 Phase 1 에서 `python-django-drf` 신규 추가만 하고 기존 이름은 유지.

---

## 6. 빌드/검증 체크리스트 (모든 PR 공통)

CLAUDE.md 룰 준수:

- [ ] `pnpm typecheck` 통과
- [ ] `pnpm build` 성공
- [ ] `pnpm test` 통과
- [ ] 커밋 메시지·PR 본문·코드에 AI 생성 표시 없음
- [ ] vault entry 출력 규약 (4문장 STAR, 메타 라인 포맷) 유지 — 새 스택이 기존 형식을 깨지 않는지 e2e 로 확인

---

## 7. Out of scope (이번 로드맵에서 다루지 않음)

- vault 외 다른 destination (Notion DB, Linear 등) — 별도 로드맵
- 자체 SaaS 운영 모델로의 전환 — 아키텍처가 완전히 다른 방향
- entry 형식 자체 변경 (STAR 이외) — 출력 규약은 CLAUDE.md 에 명시된 contract
