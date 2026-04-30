import { describe, expect, it } from "vitest";
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
});
