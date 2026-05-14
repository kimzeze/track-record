# Python Django DRF Best Practices

Django/DRF 백엔드 PR을 평가할 때 entry 작성에 참고.

## 핵심 원칙

- **ORM N+1 회피**: 외래키·OneToOne은 `select_related`, M2M·역참조는 `prefetch_related`. `only()`/`defer()`는 측정 후 사용 (column drop이 join 비용보다 크지 않은지).
- **DRF Serializer 책임 분리**: `to_representation` 오버라이드 최소화, `SerializerMethodField`는 N+1 위험 시그널 — nested serializer가 있으면 ViewSet의 `get_queryset()`에서 `prefetch_related`로 짝 맞추기.
- **트랜잭션 경계**: `@transaction.atomic`은 가장 좁은 단위에. `with transaction.atomic()`의 savepoint 의미 의식. signal 안에서 트랜잭션을 묶지 않음 (sender의 트랜잭션을 신뢰).
- **Signals 남용 회피**: 비즈니스 로직은 service layer로, signal은 cross-cutting concern (audit log, cache invalidation) 한정. 호출 흐름 추적성을 깨면 디버깅·테스트 비용 폭증.
- **Cache 계층 선택**: 단순 조회는 low-level (`cache.get/set` + key versioning), view 단위 캐시 가능하면 `cache_page`, 모델 인스턴스에 묶인 derived 값은 `@cached_property`. invalidation 전략 (TTL vs 명시적 delete vs key versioning)을 결정문에 명시.
- **Celery 비동기 경계**: idempotency 키로 중복 실행 방어, retry policy + dead letter, task argument는 직렬화 비용 작은 ID 단위로 전달 (객체 통째 전달 금지).
- **Migration 안전성**: schema migration과 data migration을 분리, 큰 테이블 index는 `--add-index-concurrently` (PostgreSQL), `nullable 추가 → 백필 → NOT NULL` 단계적 적용, `RunPython`은 `reverse_code` 명시.
- **Permission/Throttling**: DRF `permission_classes` 합성으로 책임 분리, object-level은 `has_object_permission`, throttling은 scope별로 분리해 노이즈와 abuse를 같이 잡지 않도록.
- **Service Layer 도입 시점**: view·serializer·model 어디에도 자연스럽지 않은 로직(여러 model을 트랜잭션으로 묶거나, 외부 API 호출을 동반)은 `services/` 모듈로 추출.

## 흔한 안티패턴

- **Fat view**: APIView·ViewSet 안에 비즈니스 로직 직접 작성 → 재사용 불가, 테스트 비용 큼
- **Serializer 안에서 query 직접 호출**: `SerializerMethodField` 안 `instance.some_set.filter(...)` → 응답마다 N 회 query
- **Signal로 비즈니스 로직**: `post_save`에서 메일 발송·외부 API 호출 → 호출 흐름이 코드로 안 보임, 테스트 픽스처가 signal 부수 효과를 잘못 트리거
- **Migration에 schema + data 혼재**: 같은 migration 안에서 `AddField`와 `RunPython` 백필을 같이 → 무중단 배포 시 구버전 코드가 새 컬럼 못 읽음
- **`select_related` 없이 nested serializer**: list endpoint 응답마다 nested 만큼 query 폭발
- **글로벌 signal로 cache invalidation**: 의존성 그래프가 코드로 안 보여 신규 모델 추가 시 stale cache 남음
- **`@transaction.atomic`을 view 전체에 데코레이터**: 외부 API 호출까지 트랜잭션 안 → 락 시간 길어짐, 외부 호출 실패 시 롤백 비용

## entry 작성 시 활용

이 가이드의 원칙·안티패턴 어휘를 entry 본문 "결정" 문장에 자연스럽게 녹여라.
예: "`SerializerMethodField` 안에서 매 row마다 query를 돌던 구조를 ViewSet의 `get_queryset()`에서 `prefetch_related`로 끌어올려 list endpoint p95를 320ms → 90ms로 단축."
