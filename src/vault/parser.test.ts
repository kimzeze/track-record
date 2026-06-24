import { describe, expect, it } from "vitest";
import {
  appendEntry,
  emptyDoc,
  isRecorded,
  parseVault,
  recordedPrNumbers,
  serializeVault,
  type NewEntry,
} from "./parser.js";

const SAMPLE = `# my-app

## Performance > Caching

### Turborepo Remote Cache로 CI 62% 단축
[PR #102](https://github.com/o/my-app/pull/102) · 2026-03-15 · \`Turborepo\` \`GitHub Actions\`

1. 모노레포 18 패키지 규모에서 매 push마다 재빌드되며 CI 8분 병목.
2. Nx 대신 turbo remote cache 채택.
3. CI 8분 → 3분(62%↓).

## Reliability > Idempotency

### 결제 webhook 중복 처리 차단
[PR #88](https://github.com/o/my-app/pull/88) · 2026-02-01 · \`Django\`

1. 결제 webhook 재전송으로 이중 적립 발생.
2. idempotency key + unique 제약으로 차단.
`;

describe("recordedPrNumbers / isRecorded", () => {
  it("모든 PR 번호 추출", () => {
    expect([...recordedPrNumbers(SAMPLE)].sort((a, b) => a - b)).toEqual([88, 102]);
  });
  it("부분 일치 false-positive 없음 (#10 vs #102)", () => {
    expect(isRecorded(SAMPLE, 102)).toBe(true);
    expect(isRecorded(SAMPLE, 10)).toBe(false);
    expect(isRecorded(SAMPLE, 88)).toBe(true);
    expect(isRecorded(SAMPLE, 999)).toBe(false);
  });
});

describe("parseVault", () => {
  it("title / 카테고리 / entry 구조 추출", () => {
    const doc = parseVault(SAMPLE);
    expect(doc.title).toBe("my-app");
    expect(doc.categories.map((c) => c.name)).toEqual([
      "Performance > Caching",
      "Reliability > Idempotency",
    ]);
    const first = doc.categories[0]?.entries[0];
    expect(first?.headline).toBe("Turborepo Remote Cache로 CI 62% 단축");
    expect(first?.metaLine).toContain("[PR #102]");
    expect(first?.prNumbers).toEqual([102]);
    expect(first?.date).toBe("2026-03-15");
    expect(first?.bodyLines.length).toBe(3);
    expect(first?.bodyLines[0]).toContain("모노레포 18 패키지");
  });

  it("빈 문자열 → 빈 doc, throw 없음", () => {
    const doc = parseVault("");
    expect(doc.title).toBe("");
    expect(doc.categories).toEqual([]);
  });

  it("비정형 입력에도 throw 하지 않음", () => {
    expect(() => parseVault("그냥 텍스트\n### 헤딩만 있고 카테고리 없음\n본문")).not.toThrow();
    expect(() => parseVault("## cat\n## cat2\n### e")).not.toThrow();
  });
});

describe("serializeVault — 라운드트립 / 멱등", () => {
  it("parse→serialize 가 구조를 보존", () => {
    const out = serializeVault(parseVault(SAMPLE));
    const re = parseVault(out);
    expect(re.title).toBe("my-app");
    expect(re.categories.map((c) => c.name)).toEqual([
      "Performance > Caching",
      "Reliability > Idempotency",
    ]);
    expect(re.categories[0]?.entries[0]?.bodyLines).toEqual(
      parseVault(SAMPLE).categories[0]?.entries[0]?.bodyLines,
    );
  });

  it("idempotent: 한 번 정규화하면 다시 돌려도 동일", () => {
    const once = serializeVault(parseVault(SAMPLE));
    const twice = serializeVault(parseVault(once));
    expect(twice).toBe(once);
  });

  it("body 텍스트 verbatim 보존", () => {
    const out = serializeVault(parseVault(SAMPLE));
    expect(out).toContain("1. 모노레포 18 패키지 규모에서 매 push마다 재빌드되며 CI 8분 병목.");
    expect(out).toContain("2. idempotency key + unique 제약으로 차단.");
  });

  it("단일 trailing newline", () => {
    const out = serializeVault(parseVault(SAMPLE));
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });
});

const NEW: NewEntry = {
  category: "Performance > Caching",
  headline: "Redis 캐시 도입으로 p95 60% 개선",
  metaLine: "[PR #120](https://github.com/o/my-app/pull/120) · 2026-04-01 · `Redis`",
  body: "1. 동일 카테고리 새 작업.\n2. Redis 도입.",
};

describe("appendEntry", () => {
  it("기존 카테고리에 날짜 desc 로 삽입 (최신이 위)", () => {
    const doc = parseVault(SAMPLE);
    appendEntry(doc, NEW, 120, "2026-04-01");
    const cat = doc.categories.find((c) => c.name === "Performance > Caching");
    expect(cat?.entries.map((e) => e.date)).toEqual(["2026-04-01", "2026-03-15"]);
    expect(cat?.entries[0]?.headline).toBe("Redis 캐시 도입으로 p95 60% 개선");
  });

  it("새 카테고리는 알파벳 순으로 삽입", () => {
    const doc = parseVault(SAMPLE);
    appendEntry(
      doc,
      { category: "Architecture > Service Layer", headline: "h", metaLine: "[PR #130] · 2026-05-01", body: "1. x." },
      130,
      "2026-05-01",
    );
    expect(doc.categories.map((c) => c.name)).toEqual([
      "Architecture > Service Layer",
      "Performance > Caching",
      "Reliability > Idempotency",
    ]);
  });

  it("append 후 직렬화하면 새 PR 번호가 기록됨", () => {
    const doc = parseVault(SAMPLE);
    appendEntry(doc, NEW, 120, "2026-04-01");
    const out = serializeVault(doc);
    expect(isRecorded(out, 120)).toBe(true);
    expect(isRecorded(out, 102)).toBe(true);
  });

  it("빈 doc 에 append (fresh)", () => {
    const doc = emptyDoc("new-project");
    appendEntry(doc, NEW, 120, "2026-04-01");
    const out = serializeVault(doc);
    expect(out.startsWith("# new-project\n")).toBe(true);
    expect(out).toContain("## Performance > Caching");
    expect(out).toContain("### Redis 캐시 도입으로 p95 60% 개선");
  });

  it("append 결과도 idempotent 하게 재직렬화", () => {
    const doc = parseVault(SAMPLE);
    appendEntry(doc, NEW, 120, "2026-04-01");
    const once = serializeVault(doc);
    const twice = serializeVault(parseVault(once));
    expect(twice).toBe(once);
  });
});
