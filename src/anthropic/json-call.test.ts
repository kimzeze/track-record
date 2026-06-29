import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { callJsonModel } from "./json-call.js";

const sampleSchema = z.object({ pass: z.boolean(), reason: z.string() });

function fakeClient(responseText: string): Anthropic {
  const fake = {
    messages: {
      create: async () => ({
        content: [{ type: "text", text: responseText }],
      }),
    },
  };
  return fake as unknown as Anthropic;
}

function clientFromCreate(create: () => Promise<unknown>): Anthropic {
  return { messages: { create } } as unknown as Anthropic;
}

const okResponse = { content: [{ type: "text", text: '{"pass": true, "reason": "ok"}' }] };

describe("callJsonModel", () => {
  it("raw JSON 응답 파싱", async () => {
    const client = fakeClient(`{"pass": true, "reason": "ok"}`);
    const result = await callJsonModel({
      client,
      model: "test",
      system: [],
      userText: "x",
      schema: sampleSchema,
    });
    expect(result).toEqual({ pass: true, reason: "ok" });
  });

  it("```json 코드펜스 응답 파싱", async () => {
    const client = fakeClient('```json\n{"pass": false, "reason": "skip"}\n```');
    const result = await callJsonModel({
      client,
      model: "test",
      system: [],
      userText: "x",
      schema: sampleSchema,
    });
    expect(result).toEqual({ pass: false, reason: "skip" });
  });

  it("본문에 ``` 코드펜스가 끼어 있어도 파싱 (그리디 매칭)", async () => {
    const client = fakeClient(
      '```json\n{"pass": true, "reason": "예시 ```ts\\nconst x = {}\\n``` 포함"}\n```',
    );
    const result = await callJsonModel({
      client,
      model: "test",
      system: [],
      userText: "x",
      schema: sampleSchema,
    });
    expect(result.pass).toBe(true);
    expect(result.reason).toContain("```ts");
  });

  it("앞뒤 산문 + JSON 파싱", async () => {
    const client = fakeClient('판정 결과:\n{"pass": true, "reason": "go"}\n끝.');
    const result = await callJsonModel({
      client,
      model: "test",
      system: [],
      userText: "x",
      schema: sampleSchema,
    });
    expect(result).toEqual({ pass: true, reason: "go" });
  });

  it("스키마 위반 시 throw", async () => {
    const client = fakeClient('{"pass": "yes", "reason": "x"}');
    await expect(
      callJsonModel({
        client,
        model: "test",
        system: [],
        userText: "x",
        schema: sampleSchema,
      }),
    ).rejects.toThrow(/스키마 불일치/);
  });

  it("JSON 추출 실패 시 throw", async () => {
    const client = fakeClient("이건 그냥 텍스트");
    await expect(
      callJsonModel({
        client,
        model: "test",
        system: [],
        userText: "x",
        schema: sampleSchema,
      }),
    ).rejects.toThrow(/JSON 추출 실패/);
  });

  it("일시적 연결 끊김(Premature close)은 재시도 후 성공", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const create = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          "Invalid response body while trying to fetch https://api.anthropic.com/v1/messages: Premature close",
        ),
      )
      .mockResolvedValue(okResponse);
    const result = await callJsonModel({
      client: clientFromCreate(create),
      model: "test",
      system: [],
      userText: "x",
      schema: sampleSchema,
      retryBaseDelayMs: 0,
    });
    expect(result).toEqual({ pass: true, reason: "ok" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("연결 끊김이 지속되면 재시도 소진 후 throw", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const create = vi.fn().mockRejectedValue(new Error("socket hang up"));
    await expect(
      callJsonModel({
        client: clientFromCreate(create),
        model: "test",
        system: [],
        userText: "x",
        schema: sampleSchema,
        maxRetries: 2,
        retryBaseDelayMs: 0,
      }),
    ).rejects.toThrow(/socket hang up/);
    expect(create).toHaveBeenCalledTimes(3); // 최초 1 + 재시도 2
  });

  it("스키마 위반은 재시도하지 않음 (1회 호출)", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"pass": "yes", "reason": "x"}' }],
    });
    await expect(
      callJsonModel({
        client: clientFromCreate(create),
        model: "test",
        system: [],
        userText: "x",
        schema: sampleSchema,
        retryBaseDelayMs: 0,
      }),
    ).rejects.toThrow(/스키마 불일치/);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
