import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { CachedTextBlock } from "./client.js";

export interface JsonCallOptions<T> {
  client: Anthropic;
  model: string;
  system: CachedTextBlock[];
  userText: string;
  schema: z.ZodSchema<T>;
  maxTokens?: number;
}

export async function callJsonModel<T>(opts: JsonCallOptions<T>): Promise<T> {
  const response = await opts.client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [{ role: "user", content: opts.userText }],
  });

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

function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const candidate = fence?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`JSON 추출 실패: ${text.slice(0, 200)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
