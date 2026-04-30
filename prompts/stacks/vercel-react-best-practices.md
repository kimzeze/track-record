# Vercel React Best Practices

React 컴포넌트·hook·렌더링 관련 PR을 평가할 때 entry 작성에 참고.

## 핵심 원칙

- **Server Components 우선**: 데이터 fetching·정적 트리는 RSC. `'use client'`는 인터랙션이 필요한 leaf 컴포넌트만.
- **렌더 비용 최소화**: `useMemo`/`useCallback`은 측정 후 도입. 무지성 사용은 안티패턴 (오히려 dependency 비교 비용 발생).
- **상태 위치**: 가장 가까운 공통 조상까지만 끌어올림. 전역 상태는 진짜 전역만.
- **데이터 fetching 우선순위**: RSC > Server Action > Route Handler > 클라이언트 fetch. TanStack Query는 클라이언트 측 캐시·동기화가 필수일 때만.
- **Effect 최소화**: `useEffect`는 외부 시스템 동기화 전용. 파생값은 derived state로, 이벤트 응답은 핸들러로.
- **Suspense + 스트리밍**: 의존성 분리, `loading.tsx`로 단계적 노출, `<Suspense fallback={...}>`로 청크 단위 스트림.
- **번들 분리**: dynamic import + chunk boundary 의식, route 단위 split.
- **Image / Font**: `next/image`·`next/font` 또는 동등 도구로 layout shift·웹폰트 FOUT 방지.

## 흔한 안티패턴

- `'use client'` 무분별 적용 → root까지 client tree 확장
- `ref`로 mutation, `key`로 강제 리마운트 (특수 케이스 외)
- 동일 데이터를 여러 컴포넌트가 직접 fetch → 캐시 미공유
- Effect 안에서 `setState`로 derived 계산 (대신 render 단계 derived state)
- Context로 자주 바뀌는 값 전달 → 광범위 리렌더

## entry 작성 시 활용

이 가이드의 원칙·안티패턴 어휘를 entry 본문 "결정" 문장에 자연스럽게 녹여라. 예: "전역 Context로 자주 바뀌는 값을 전달하던 구조를 vs ... 채택하여 ..."
