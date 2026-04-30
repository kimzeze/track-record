# Entry Merger

새 entry를 기존 프로젝트 .md 파일에 통합한다. 출력은 **파일 전체 내용**이다.

## 입력

- `existingMarkdown`: 기존 `{username}/{project}.md` 전체 내용 (없으면 빈 문자열)
- `newEntry`: 방금 작성한 entry (category, headline, metaLine, body)
- `projectName`: 파일 제목으로 사용

## 머지 결정 룰

1. **fresh** — `existingMarkdown`이 빈 문자열일 때
   - `# {projectName}` + `## {category}` + `### {headline}` + 메타 + 본문 으로 신규 작성

2. **merge** — 동일 category 안에 비슷한 주제(headline·body 키워드 유사도 높음)인 기존 H3 블록이 있을 때
   - 기존 블록의 본문에 새 metric/내용을 자연스러운 1-2문장으로 추가
   - 메타 라인을 두 PR 모두 표기 (PR 링크 둘, 날짜 둘, stack 합집합)
   - 헤드라인은 더 종합적인 표현으로 갱신
   - **5문장 한도는 유지** — 초과하면 가장 덜 중요한 문장 압축

3. **append** — 같은 category에 별개 주제이거나, 카테고리 자체가 새로울 때
   - 같은 category H2가 있으면 → 그 아래에 ### 새 entry 추가
   - 없으면 → 새 ## category 섹션 + ### entry 추가

## 정렬

- H2 카테고리: 알파벳 오름차순
- 같은 카테고리 내 H3 entry: 메타 날짜 내림차순 (최근이 위)

## 형식 보존

- 기존 다른 카테고리·entry는 일체 변경하지 마라 (오직 머지 대상 블록만 수정)
- 마크다운 구조 (헤딩 깊이, 빈 줄, 메타 라인 포맷) 일관성 유지
- **본문은 번호 리스트(1. 2. 3. 4.)로 작성한다.** 기존 entry가 한 단락 빽빽이거나 빈 줄 분리 형식이라도 머지·재작성 시에는 번호 리스트 형식으로 변환하라.
- 이모지 사용 금지 (vault entry 어디에도).

## 출력 (JSON only)

```json
{
  "action": "merge" | "append" | "fresh",
  "updatedMarkdown": "# project_name\n\n## Performance > Caching\n### Turborepo Remote Cache로 CI 62% 단축\n[PR #102](...) · 2026-03-15 · `Turborepo`\n\n모노레포 18 패키지...\n",
  "reason": "기존 'Build Cache' 블록과 주제 중첩 → metric 통합"
}
```

`updatedMarkdown`은 **파일 전체 내용**. 절대 일부만 출력하지 마라.

JSON 외 다른 텍스트는 절대 출력하지 마라.
