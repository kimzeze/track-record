import { describe, expect, it } from "vitest";
import { estimateTokens, isExcluded, truncateToBudget } from "./diff-parser.js";

describe("isExcluded", () => {
  it("정확 일치", () => {
    expect(isExcluded("pnpm-lock.yaml", ["pnpm-lock.yaml"])).toBe(true);
    expect(isExcluded("package.json", ["pnpm-lock.yaml"])).toBe(false);
  });

  it("glob *", () => {
    expect(isExcluded("a.test.ts", ["*.test.ts"])).toBe(true);
    expect(isExcluded("a.test.tsx", ["*.test.ts"])).toBe(false);
    expect(isExcluded("foo/bar.snap", ["*.snap"])).toBe(true);
  });

  it("정규식 메타문자 이스케이프", () => {
    expect(isExcluded("a.b+c", ["a.b+c"])).toBe(true);
    expect(isExcluded("axb+c", ["a.b+c"])).toBe(false);
  });
});

describe("estimateTokens", () => {
  it("chars/3 추정", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abc")).toBe(1);
    expect(estimateTokens("abcdef")).toBe(2);
    expect(estimateTokens("abcdefg")).toBe(3);
  });
});

describe("truncateToBudget", () => {
  it("예산 이하면 통과", () => {
    const r = truncateToBudget("hello", 100);
    expect(r.truncated).toBe(false);
    expect(r.text).toBe("hello");
  });

  it("예산 초과 시 절단", () => {
    const long = "x".repeat(1000);
    const r = truncateToBudget(long, 10);
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBe(30);
  });
});
