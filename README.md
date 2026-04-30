# Track Record

PR이 머지될 때마다 자동으로 "이력서감"을 판단해 vault 레포에 4문장 STAR 형식으로 적립하는 reusable GitHub Action.

## 핵심 흐름

1. PR `closed` + `merged: true` → caller workflow 발동
2. reusable workflow `curate.yml` 호출 — diff 분석 시작
3. AI 큐레이터 4단계: judge → match → build → merge
4. 임계 통과 시 `{TARGET_REPO}/{username}/{project}.md` 에 push

자세한 요구사항·결정사항은 [SPEC.md](./SPEC.md), 적용 방법은 [docs/SETUP_GUIDE.md](./docs/SETUP_GUIDE.md).

## 빠른 시작

대상 레포의 `.github/workflows/track-record.yml` 에 [caller-templates/track-record-caller.yml](./caller-templates/track-record-caller.yml) 복사 후 secret 설정.

| Secret | 용도 |
|---|---|
| `ANTHROPIC_API_KEY` | AI 분석 |
| `TARGET_TOKEN` | vault repo write 권한 PAT |

## 참조 모델

[`aptimizer-co/fe-senior-reviewer`](https://github.com/aptimizer-co/fe-senior-reviewer) 의 reusable workflow + caller template 패턴을 따름.
