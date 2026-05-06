import { describe, expect, it } from "vitest";
import {
  calculateCost,
  findPricing,
  normalizeUsage,
  UsageTracker,
} from "./usage.js";

describe("findPricing", () => {
  it("정확한 prefix 매칭", () => {
    expect(findPricing("claude-haiku-4-5")?.input).toBe(1);
    expect(findPricing("claude-sonnet-4-6")?.output).toBe(15);
    expect(findPricing("claude-opus-4-7")?.input).toBe(5);
  });

  it("longest prefix 우선 — opus-4-7이 opus-4보다 우선", () => {
    expect(findPricing("claude-opus-4-7-20260101")?.input).toBe(5); // 4.5+ 가격
    expect(findPricing("claude-opus-4-20250101")?.input).toBe(15); // 4 가격
  });

  it("Haiku 4.5 < Haiku 3.5 가격", () => {
    expect(findPricing("claude-haiku-4-5")?.input).toBe(1);
    expect(findPricing("claude-haiku-3-5")?.input).toBe(0.8);
  });

  it("매칭 실패 시 undefined", () => {
    expect(findPricing("gpt-4")).toBeUndefined();
    expect(findPricing("claude-3-something")).toBeUndefined();
  });
});

describe("normalizeUsage", () => {
  it("null/undefined 안전", () => {
    expect(normalizeUsage(null)).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    });
    expect(normalizeUsage(undefined)).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    });
  });

  it("일부 필드 누락", () => {
    expect(
      normalizeUsage({
        input_tokens: 100,
        output_tokens: 50,
      }),
    ).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    });
  });
});

describe("calculateCost", () => {
  it("Haiku 4.5 단순 input/output", () => {
    // 1M input * $1 + 1M output * $5 = $6
    const cost = calculateCost("claude-haiku-4-5", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    });
    expect(cost).toBeCloseTo(6, 6);
  });

  it("Sonnet 4.6 캐시 포함", () => {
    // input 1k * $3/M = $0.003
    // output 500 * $15/M = $0.0075
    // cache write 1k * $3.75/M = $0.00375
    // cache read 10k * $0.30/M = $0.003
    const cost = calculateCost("claude-sonnet-4-6", {
      inputTokens: 1000,
      outputTokens: 500,
      cacheWriteTokens: 1000,
      cacheReadTokens: 10000,
    });
    expect(cost).toBeCloseTo(0.003 + 0.0075 + 0.00375 + 0.003, 6);
  });

  it("매칭 실패 모델은 0", () => {
    const cost = calculateCost("unknown-model", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    });
    expect(cost).toBe(0);
  });
});

describe("UsageTracker", () => {
  it("초기 totals 0", () => {
    const t = new UsageTracker();
    expect(t.total()).toEqual({
      callCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      costUsd: 0,
    });
  });

  it("여러 호출 누적", () => {
    const t = new UsageTracker();
    t.record("claude-haiku-4-5", { input_tokens: 100, output_tokens: 50 });
    t.record("claude-sonnet-4-6", { input_tokens: 200, output_tokens: 100 });
    const total = t.total();
    expect(total.callCount).toBe(2);
    expect(total.inputTokens).toBe(300);
    expect(total.outputTokens).toBe(150);
    expect(total.costUsd).toBeGreaterThan(0);
  });

  it("usage가 null이어도 callCount만 증가", () => {
    const t = new UsageTracker();
    t.record("claude-haiku-4-5", null);
    expect(t.total().callCount).toBe(1);
    expect(t.total().inputTokens).toBe(0);
    expect(t.total().costUsd).toBe(0);
  });

  it("total()은 외부에서 조작 안 됨 (defensive copy)", () => {
    const t = new UsageTracker();
    t.record("claude-haiku-4-5", { input_tokens: 100, output_tokens: 50 });
    const snap1 = t.total();
    snap1.inputTokens = 99999;
    expect(t.total().inputTokens).toBe(100);
  });
});
