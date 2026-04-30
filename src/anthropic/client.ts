import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | undefined;

export function getAnthropic(apiKey: string): Anthropic {
  if (!cached) {
    cached = new Anthropic({ apiKey });
  }
  return cached;
}

export interface CachedTextBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

// 마지막 블록에만 cache_control 적용 (입력 토큰 ~90% 할인)
export function buildCachedSystem(parts: string[]): CachedTextBlock[] {
  return parts.map((text, i) => {
    const isLast = i === parts.length - 1;
    if (isLast) {
      return { type: "text", text, cache_control: { type: "ephemeral" } };
    }
    return { type: "text", text };
  });
}
