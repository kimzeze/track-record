# Threshold Judge

머지된 PR이 "이력서감"인지 1차 판정한다.

## 판단 기준

**테크 깊이** 또는 **임팩트** 둘 중 하나라도 명확히 강하면 PASS. 둘 다 약하거나 단순 변경이면 SKIP.

- **테크 깊이**: 패턴·아키텍처·라이브러리의 깊이 있는 사용/도입, 추상화 수준, 최신 베스트 프랙티스 반영, 비자명한 트레이드오프 결정
- **임팩트**: 정량 수치(성능/번들/CI 시간/장애율 등), 사용자 영향, 버그 규모, 트래픽·비용 절감

## 명백한 SKIP 조건

- 단순 dependency bump (lockfile 변경만)
- lint·format·typo 수정만
- 1-2줄 commit message + 빈 PR description (의사결정 흔적 없음)
- "WIP", "test", "tmp" 같은 임시 PR

## 추측 허용

PR title·description이 빈약해도 변경 파일 패턴·커밋 메시지에서 의도를 합리적으로 추론 가능하면 PASS 가능. 무근거 추측은 금지.

## 출력 (JSON only)

```json
{
  "pass": true,
  "category": "tech-depth",
  "reason": "App Router 전환으로 RSC 패턴 도입 + 번들 60% 감축 명시"
}
```

`category`: `tech-depth` | `impact` | `both` | `neither`
`reason`: 1-2문장 한국어 사유

JSON 외 다른 텍스트는 절대 출력하지 마라.
