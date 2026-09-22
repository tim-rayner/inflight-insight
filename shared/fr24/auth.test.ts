import { describe, expect, it } from "vitest";
import { getFr24Headers } from "./auth";

describe("getFr24Headers", () => {
  it("builds the Authorization, Accept-Version, and Accept headers from an API token", () => {
    const headers = getFr24Headers({ apiToken: "test-token" });

    expect(headers.Authorization).toBe("Bearer test-token");
    expect(headers["Accept-Version"]).toBe("v1");
    expect(headers.Accept).toBe("application/json");
  });

  it("throws when the API token is empty", () => {
    expect(() => getFr24Headers({ apiToken: "" })).toThrow(
      /FR24 API token is not configured/,
    );
  });

  it("throws when the API token is only whitespace", () => {
    expect(() => getFr24Headers({ apiToken: "   " })).toThrow(
      /FR24 API token is not configured/,
    );
  });
});
