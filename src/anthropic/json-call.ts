import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { CachedTextBlock } from "./client.js";
import type { UsageTracker } from "./usage.js";

export interface JsonCallOptions<T> {
  client: Anthropic;
  model: string;
  system: CachedTextBlock[];
  userText: string;
  schema: z.ZodSchema<T>;
  maxTokens?: number;
  tracker?: UsageTracker;
  // 일시적 연결 끊김(Premature close 등) 대비 재시도 — 기본값 보유, 테스트에서 주입 가능.
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_RETRY_BASE_MS = 500;
const RETRY_DELAY_CAP_MS = 8_000;

export async function callJsonModel<T>(opts: JsonCallOptions<T>): Promise<T> {
  const response = await createWithRetry(opts);

  if (opts.tracker) {
    opts.tracker.record(opts.model, response.usage);
  }

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("응답에 text 블록 없음");
  }

  const json = extractJson(block.text);
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `응답 스키마 불일치: ${parsed.error.message}\n원문(앞 500자): ${block.text.slice(0, 500)}`,
    );
  }
  return parsed.data;
}

// messages.create만 재시도로 감싼다. 파싱/스키마 검증은 호출부에서 루프 밖이라
// 결정론 에러(스키마 불일치 등)는 재시도되지 않는다.
async function createWithRetry<T>(
  opts: JsonCallOptions<T>,
): Promise<Anthropic.Messages.Message> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = opts.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_MS;

  for (let attempt = 0; ; attempt++) {
    try {
      return await opts.client.messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 4096,
        system: opts.system,
        messages: [{ role: "user", content: opts.userText }],
      });
    } catch (err) {
      if (attempt >= maxRetries || !isRetryableError(err)) {
        throw err;
      }
      const delay = backoffDelay(attempt, baseDelay);
      console.warn(
        `[json-call] 재시도 ${attempt + 1}/${maxRetries} (${opts.model}, ${summarizeError(err)}) — ${delay}ms 후`,
      );
      await sleep(delay);
    }
  }
}

// 일시적 transport 에러만 재시도. SDK 에러 클래스 + 저수준 fetch/undici 메시지 매칭.
function isRetryableError(err: unknown): boolean {
  if (err instanceof Anthropic.APIConnectionError) {
    return true; // 연결 끊김/타임아웃
  }
  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    return (
      status === 408 ||
      status === 409 ||
      status === 429 ||
      (typeof status === "number" && status >= 500)
    );
  }
  const code = typeof (err as { code?: unknown })?.code === "string" ? (err as { code: string }).code : "";
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
  const haystack = `${String(err)} ${err instanceof Error ? err.message : ""} ${cause} ${code}`.toLowerCase();
  return /premature close|invalid response body|terminated|econnreset|socket hang up|other side closed|fetch failed|und_err|enotfound|eai_again/.test(
    haystack,
  );
}

function summarizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 120);
}

function backoffDelay(attempt: number, base: number): number {
  const exp = Math.min(base * 2 ** attempt, RETRY_DELAY_CAP_MS);
  const jitter = exp * 0.2 * (Math.random() * 2 - 1); // ±20%
  return Math.max(0, Math.round(exp + jitter));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJson(text: string): unknown {
  // 그리디(+): 닫는 펜스를 "마지막" ``` 으로 잡아, 본문에 끼어든 코드펜스가 캡처를 끊지 않게 한다.
  const fence = text.match(/```(?:json)?\s*([\s\S]+)\s*```/);
  const candidate = fence?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`JSON 추출 실패: ${text.slice(0, 200)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
