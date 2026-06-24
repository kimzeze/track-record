import { describe, expect, it } from "vitest";
import type { CategoryBlock, EntryBlock } from "../vault/parser.js";
import { applyMerges, combineMetaLines, type CompactionResult } from "./compactor.js";

function entry(partial: Partial<EntryBlock> & { headline: string }): EntryBlock {
  return {
    headline: partial.headline,
    metaLine: partial.metaLine ?? "",
    prNumbers: partial.prNumbers ?? [],
    date: partial.date ?? "",
    bodyLines: partial.bodyLines ?? ["1. body."],
  };
}

describe("combineMetaLines", () => {
  it("PR 링크 합집합 · 날짜 desc · stack 합집합", () => {
    const a = entry({
      headline: "a",
      metaLine: "[PR #1](u1) · 2026-01-01 · `a` `b`",
    });
    const b = entry({
      headline: "b",
      metaLine: "[PR #3](u3) · 2026-03-01 · `b` `c`",
    });
    expect(combineMetaLines([a, b])).toBe(
      "[PR #1](u1) [PR #3](u3) · 2026-03-01, 2026-01-01 · `a` `b` `c`",
    );
  });

  it("중복 PR 링크 제거", () => {
    const a = entry({ headline: "a", metaLine: "[PR #1](u1) · 2026-01-01" });
    const b = entry({ headline: "b", metaLine: "[PR #1](u1) · 2026-01-01" });
    expect(combineMetaLines([a, b])).toBe("[PR #1](u1) · 2026-01-01");
  });
});

function sampleCategory(): CategoryBlock {
  return {
    name: "Performance > Caching",
    descLines: [],
    entries: [
      entry({ headline: "h0", metaLine: "[PR #1](u1) · 2026-01-01 · `a`", prNumbers: [1], date: "2026-01-01" }),
      entry({ headline: "h1", metaLine: "[PR #2](u2) · 2026-02-01 · `b`", prNumbers: [2], date: "2026-02-01" }),
      entry({ headline: "h2", metaLine: "[PR #3](u3) · 2026-03-01 · `a` `c`", prNumbers: [3], date: "2026-03-01" }),
    ],
  };
}

describe("applyMerges", () => {
  it("지정된 그룹만 통합, 나머지 entry 는 손대지 않음", () => {
    const cat = sampleCategory();
    const result: CompactionResult = {
      merges: [
        { primaryId: "e0", mergeIds: ["e2"], headline: "통합됨", body: "1. 합친 본문.", reason: "동일 작업" },
      ],
    };
    const res = applyMerges(cat, result);
    expect(res.changed).toBe(true);
    expect(res.mergedGroups).toBe(1);
    expect(cat.entries.length).toBe(2);

    const merged = cat.entries.find((e) => e.headline === "통합됨");
    expect(merged?.prNumbers.sort((a, b) => a - b)).toEqual([1, 3]);
    expect(merged?.metaLine).toContain("[PR #1]");
    expect(merged?.metaLine).toContain("[PR #3]");
    expect(merged?.date).toBe("2026-03-01");
    expect(merged?.bodyLines).toEqual(["1. 합친 본문."]);

    // h1 은 그대로 존재
    expect(cat.entries.some((e) => e.headline === "h1")).toBe(true);
  });

  it("통합 후 날짜 desc 정렬", () => {
    const cat = sampleCategory();
    applyMerges(cat, {
      merges: [{ primaryId: "e0", mergeIds: ["e2"], headline: "통합됨", body: "1. x.", reason: "r" }],
    });
    expect(cat.entries.map((e) => e.date)).toEqual(["2026-03-01", "2026-02-01"]);
  });

  it("merges 가 비면 변경 없음", () => {
    const cat = sampleCategory();
    const res = applyMerges(cat, { merges: [] });
    expect(res.changed).toBe(false);
    expect(cat.entries.length).toBe(3);
  });

  it("존재하지 않는 id 는 무시", () => {
    const cat = sampleCategory();
    const res = applyMerges(cat, {
      merges: [{ primaryId: "e0", mergeIds: ["e99"], headline: "x", body: "1. y.", reason: "r" }],
    });
    expect(res.changed).toBe(false);
    expect(cat.entries.length).toBe(3);
  });
});
