import { describe, expect, it } from "vitest";
import { userIndexPath, vaultEntryPath, vaultRootReadmePath } from "./path-resolver.js";

describe("vaultEntryPath", () => {
  it("일반 케이스", () => {
    expect(vaultEntryPath("kimzeze", "my-app")).toBe("kimzeze/my-app.md");
  });

  it("특수문자 sanitize", () => {
    expect(vaultEntryPath("user/name", "proj@1")).toBe("user-name/proj-1.md");
  });

  it("dot, dash, underscore 보존", () => {
    expect(vaultEntryPath("a_b", "v1.0-test")).toBe("a_b/v1.0-test.md");
  });
});

describe("userIndexPath", () => {
  it("README.md 경로", () => {
    expect(userIndexPath("kimzeze")).toBe("kimzeze/README.md");
  });
});

describe("vaultRootReadmePath", () => {
  it("루트 README", () => {
    expect(vaultRootReadmePath).toBe("README.md");
  });
});
