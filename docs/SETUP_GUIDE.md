# 적용 가이드

새 레포(또는 기존 레포)에 track-record를 붙이는 절차.

## 사전 준비

### 1. Vault 레포 만들기

조직(또는 개인)이 한 개 만든다. 이력서 .md 들이 누적될 곳.

```
GitHub 새 레포 → 이름: track-record-vault (또는 자유)
가시성: private 권장 (사람별 작업 기록이라)
빈 레포로 시작 — README/폴더는 첫 push 시 자동 생성됨
```

### 2. PAT 발급 (vault 쓰기용)

1. GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. **Repository access**: vault 레포만 선택
3. **Repository permissions**:
   - `Contents`: Read and write
   - `Metadata`: Read-only (자동)
4. 토큰 복사

### 3. Anthropic API key

[console.anthropic.com](https://console.anthropic.com) 에서 발급.

## 적용 (caller 레포 측)

### 4. caller workflow 복사

대상 레포의 `.github/workflows/track-record.yml` 에 [`caller-templates/track-record-caller.yml`](../caller-templates/track-record-caller.yml) 내용 복사.

`target_repo` 만 자기 vault 경로로 바꾸면 됨:

```yaml
with:
  target_repo: "your-org/track-record-vault"
```

### 5. Secret 등록

대상 레포 Settings → Secrets and variables → Actions:

| Secret | 값 |
|---|---|
| `ANTHROPIC_API_KEY` | 위 3에서 받은 키 |
| `TARGET_TOKEN` | 위 2에서 받은 PAT |

### 6. 동작 확인

대상 레포에서 PR 머지 → Actions 탭에서 `Track Record` 워크플로우 확인.
- 임계 통과 시: vault 레포에 `{username}/{project}.md` 생성·갱신
- 임계 미달 시: workflow 로그에 "임계 미달 → SKIP"

## 옵션 튜닝

`with:` 절에 추가 가능 (기본값 쓰려면 생략):

```yaml
with:
  target_repo: "your-org/track-record-vault"
  model_judge: "claude-haiku-4-5"        # 1차 판정 모델 (가벼운 게 권장)
  model_builder: "claude-sonnet-4-6"     # entry 작성·머지 모델
  diff_token_budget: 80000                # 초과 시 메타데이터 모드로 폴백
  exclude_patterns: "pnpm-lock.yaml,*.test.ts,*.snap"
```

## 트러블슈팅

| 증상 | 원인 후보 |
|---|---|
| "환경변수 검증 실패" | secret 미등록 또는 caller 입력 누락 |
| vault 푸시 403 | TARGET_TOKEN 권한 부족 (Contents: Write 필요) |
| 모든 PR이 SKIP | `prompts/curator/threshold-judge.md` 기준이 너무 엄격 — 프롬프트 조정 |
| "JSON 추출 실패" | 모델 응답 형식 이탈 — `prompts/curator/*.md` 의 출력 섹션 강조 |
