import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FLIGHT_SUMMARY_URL = "https://fr24api.flightradar24.com/api/flight-summary/light";

const originalEnv = { ...process.env };

describe("checkFlightCallable", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.FR24_API_TOKEN = "test-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("returns callable: true with the resolved callsign and raw record for an in-progress flight", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: [
          {
            fr24_id: "391fdd79",
            flight: "BA285",
            callsign: "BAW285",
            operating_as: "BAW",
            orig_icao: "EGLL",
            dest_icao: "KORD",
            datetime_takeoff: "2026-09-12T10:20:00Z",
            datetime_landed: null,
            first_seen: "2026-09-12T10:20:00Z",
            last_seen: "2026-09-12T12:50:00Z",
            flight_ended: false,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { checkFlightCallable } = await import("./flight");
    const result = await checkFlightCallable("BA285");

    expect(result.callable).toBe(true);
    expect(result.callsign).toBe("BAW285");
    expect(result.record).toMatchObject({ flight: "BA285", callsign: "BAW285" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(FLIGHT_SUMMARY_URL);
    expect(String(url)).toContain("flights=BA285");
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(options.headers["Accept-Version"]).toBe("v1");
  });

  it("returns callable: false when the most recent matching flight has already ended", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: [
          {
            fr24_id: "abc123",
            flight: "BA285",
            callsign: "BAW285",
            flight_ended: true,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { checkFlightCallable } = await import("./flight");
    const result = await checkFlightCallable("BA285");

    expect(result.callable).toBe(false);
    expect(result.callsign).toBe("BAW285");
  });

  it("returns callable: false and a null callsign when no matching flight is found", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ data: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { checkFlightCallable } = await import("./flight");
    const result = await checkFlightCallable("BA285");

    expect(result.callable).toBe(false);
    expect(result.callsign).toBeNull();
    expect(result.record).toBeNull();
  });

  it("throws when the FR24 API token is not configured", async () => {
    delete process.env.FR24_API_TOKEN;
    vi.stubGlobal("fetch", vi.fn());

    const { checkFlightCallable } = await import("./flight");

    await expect(checkFlightCallable("BA285")).rejects.toThrow(
      /FR24 API token is not configured/,
    );
  });

  it("throws when the FR24 API responds with an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      statusText: "Payment Required",
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { checkFlightCallable } = await import("./flight");

    await expect(checkFlightCallable("BA285")).rejects.toThrow(/402/);
  });
});
