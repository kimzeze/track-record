import { logger } from "../utils/logger.js";

export interface ModelPricing {
  /** USD per 1M tokens */
  input: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
  output: number;
}

/**
 * 2026-05-06 기준 Anthropic 공식 단가.
 * https://platform.claude.com/docs/en/about-claude/pricing
 *
 * 매칭은 longest-prefix-match. 정렬은 길이 desc 으로 보장.
 */
const RAW_PRICING: Array<[string, ModelPricing]> = [
  ["claude-opus-4-7", { input: 5, cacheWrite5m: 6.25, cacheWrite1h: 10, cacheRead: 0.5, output: 25 }],
  ["claude-opus-4-6", { input: 5, cacheWrite5m: 6.25, cacheWrite1h: 10, cacheRead: 0.5, output: 25 }],
  ["claude-opus-4-5", { input: 5, cacheWrite5m: 6.25, cacheWrite1h: 10, cacheRead: 0.5, output: 25 }],
  ["claude-opus-4-1", { input: 15, cacheWrite5m: 18.75, cacheWrite1h: 30, cacheRead: 1.5, output: 75 }],
  ["claude-opus-4", { input: 15, cacheWrite5m: 18.75, cacheWrite1h: 30, cacheRead: 1.5, output: 75 }],
  ["claude-sonnet-4-6", { input: 3, cacheWrite5m: 3.75, cacheWrite1h: 6, cacheRead: 0.3, output: 15 }],
  ["claude-sonnet-4-5", { input: 3, cacheWrite5m: 3.75, cacheWrite1h: 6, cacheRead: 0.3, output: 15 }],
  ["claude-sonnet-4", { input: 3, cacheWrite5m: 3.75, cacheWrite1h: 6, cacheRead: 0.3, output: 15 }],
  ["claude-haiku-4-5", { input: 1, cacheWrite5m: 1.25, cacheWrite1h: 2, cacheRead: 0.1, output: 5 }],
  ["claude-haiku-3-5", { input: 0.8, cacheWrite5m: 1, cacheWrite1h: 1.6, cacheRead: 0.08, output: 4 }],
];

export const MODEL_PRICING: ReadonlyArray<readonly [string, ModelPricing]> = [...RAW_PRICING].sort(
  (a, b) => b[0].length - a[0].length,
);

export function findPricing(model: string): ModelPricing | undefined {
  for (const [prefix, pricing] of MODEL_PRICING) {
    if (model.startsWith(prefix)) return pricing;
  }
  return undefined;
}

export interface RawUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface UsageDelta {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

export function normalizeUsage(usage: RawUsage | null | undefined): UsageDelta {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
  };
}

/**
 * 단일 호출 비용 (USD). 5m cache write 단가 적용 (default cache TTL).
 * Pricing 매칭 실패 시 0 반환 + 경고 로그.
 */
export function calculateCost(model: string, usage: UsageDelta): number {
  const pricing = findPricing(model);
  if (!pricing) {
    logger.warn("모델 가격 매칭 실패 — 비용 0으로 처리", { model });
    return 0;
  }
  const M = 1_000_000;
  return (
    (usage.inputTokens * pricing.input) / M +
    (usage.outputTokens * pricing.output) / M +
    (usage.cacheWriteTokens * pricing.cacheWrite5m) / M +
    (usage.cacheReadTokens * pricing.cacheRead) / M
  );
}

export interface UsageTotals {
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costUsd: number;
}

export class UsageTracker {
  private totals: UsageTotals = {
    callCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    costUsd: 0,
  };

  record(model: string, usage: RawUsage | null | undefined): void {
    const delta = normalizeUsage(usage);
    const cost = calculateCost(model, delta);
    this.totals = {
      callCount: this.totals.callCount + 1,
      inputTokens: this.totals.inputTokens + delta.inputTokens,
      outputTokens: this.totals.outputTokens + delta.outputTokens,
      cacheWriteTokens: this.totals.cacheWriteTokens + delta.cacheWriteTokens,
      cacheReadTokens: this.totals.cacheReadTokens + delta.cacheReadTokens,
      costUsd: this.totals.costUsd + cost,
    };
  }

  total(): UsageTotals {
    return { ...this.totals };
  }
}
