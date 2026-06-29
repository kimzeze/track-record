import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | undefined;

export function getAnthropic(apiKey: string): Anthropic {
  if (!cached) {
    // 재시도는 앱 레벨(callJsonModel)이 단독 소유 → SDK 재시도 비활성(maxRetries: 0).
    // timeout: 멈춘 소켓이 SDK 기본 10분을 잡지 않게 60초로 단축, 초과 시 앱 재시도로 복구.
    cached = new Anthropic({ apiKey, maxRetries: 0, timeout: 60_000 });
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
