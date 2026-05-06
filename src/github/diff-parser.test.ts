import { describe, expect, it } from "vitest";
import {
  estimateTokens,
  isExcluded,
  prioritizeFiles,
  type ParsedFile,
} from "./diff-parser.js";

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

describe("prioritizeFiles", () => {
  function f(path: string, adds: number, dels: number, patch?: string): ParsedFile {
    return {
      path,
      status: "modified",
      additions: adds,
      deletions: dels,
      patch: patch ?? "x".repeat((adds + dels) * 30),
    };
  }

  it("예산 충분하면 모두 포함", () => {
    const r = prioritizeFiles([f("a.ts", 5, 0), f("b.ts", 3, 0)], 10000);
    expect(r.fitsBudget).toBe(true);
    expect(r.includedCount).toBe(2);
    expect(r.excludedCount).toBe(0);
    expect(r.files.every((x) => x.patch)).toBe(true);
  });

  it("예산 초과 시 변경량 큰 파일부터 포함", () => {
    const small = f("small.ts", 1, 0); // patch 30 chars → ~10 토큰
    const big = f("big.ts", 100, 0); // patch 3000 chars → ~1000 토큰
    const r = prioritizeFiles([small, big], 100);
    expect(r.fitsBudget).toBe(false);
    // big이 우선 포함 시도 → 1000토큰 > 100예산 → big 제외, small 포함
    // 또는 big이 들어가지 못하면 small이 들어감
    const bigResult = r.files.find((x) => x.path === "big.ts");
    const smallResult = r.files.find((x) => x.path === "small.ts");
    expect(bigResult?.patchOmitted).toBe(true);
    expect(smallResult?.patch).toBeDefined();
  });

  it("순서는 입력 순서 유지", () => {
    const r = prioritizeFiles(
      [f("z.ts", 1, 0), f("a.ts", 100, 0), f("m.ts", 10, 0)],
      10000,
    );
    expect(r.files.map((x) => x.path)).toEqual(["z.ts", "a.ts", "m.ts"]);
  });

  it("동률은 path asc로 결정적 정렬", () => {
    const f1 = f("b.ts", 10, 0);
    const f2 = f("a.ts", 10, 0);
    // budget을 한 파일만 들어가도록 빡빡하게 (각 파치 300자/100 토큰, 예산 110)
    const r = prioritizeFiles([f1, f2], 110);
    // a.ts가 동률 중 path asc로 우선 → 포함
    const a = r.files.find((x) => x.path === "a.ts");
    const b = r.files.find((x) => x.path === "b.ts");
    expect(a?.patch).toBeDefined();
    expect(b?.patchOmitted).toBe(true);
  });

  it("patch 자체가 없는 파일은 비용 0으로 그대로 통과", () => {
    const noPatch: ParsedFile = {
      path: "renamed.ts",
      status: "renamed",
      additions: 0,
      deletions: 0,
    };
    const r = prioritizeFiles([noPatch], 10);
    expect(r.includedCount).toBe(0); // patch 없는 파일은 includedCount에 안 들어감
    expect(r.excludedCount).toBe(0);
    expect(r.files[0]?.patchOmitted).toBe(false);
  });
});
