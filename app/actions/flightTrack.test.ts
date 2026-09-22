import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FLIGHT_TRACKS_URL = "https://fr24api.flightradar24.com/api/flight-tracks";

const originalEnv = { ...process.env };

describe("getFlightTrack", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.FR24_API_TOKEN = "test-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("returns the fr24Id and track points for a known flight id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => [
        {
          fr24_id: "391fdd79",
          tracks: [
            {
              timestamp: "2026-09-12T10:20:00Z",
              lat: 51.4706,
              lon: -0.4619,
              alt: 1200,
              gspeed: 180,
              vspeed: 1500,
              track: 270,
              squawk: "1000",
              callsign: "BAW285",
              source: "ADSB",
            },
            {
              timestamp: "2026-09-12T10:25:00Z",
              lat: 51.5,
              lon: -1.2,
              alt: 15000,
              gspeed: 320,
              vspeed: 2000,
              track: 275,
              squawk: "1000",
              callsign: "BAW285",
              source: "ADSB",
            },
          ],
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getFlightTrack } = await import("./flightTrack");
    const result = await getFlightTrack("391fdd79");

    expect(result.fr24Id).toBe("391fdd79");
    expect(result.track).toHaveLength(2);
    expect(result.track[0]).toMatchObject({ lat: 51.4706, lon: -0.4619 });

    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(FLIGHT_TRACKS_URL);
    expect(String(url)).toContain("flight_id=391fdd79");
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(options.headers["Accept-Version"]).toBe("v1");
  });

  it("returns an empty track array when FR24 has no positions for the flight", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => [{ fr24_id: "391fdd79", tracks: [] }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getFlightTrack } = await import("./flightTrack");
    const result = await getFlightTrack("391fdd79");

    expect(result.track).toEqual([]);
  });

  it("throws when fr24Id is empty", async () => {
    vi.stubGlobal("fetch", vi.fn());

    const { getFlightTrack } = await import("./flightTrack");

    await expect(getFlightTrack("")).rejects.toThrow(/fr24Id is required/);
  });

  it("throws when the FR24 API token is not configured", async () => {
    delete process.env.FR24_API_TOKEN;
    vi.stubGlobal("fetch", vi.fn());

    const { getFlightTrack } = await import("./flightTrack");

    await expect(getFlightTrack("391fdd79")).rejects.toThrow(
      /FR24 API token is not configured/,
    );
  });

  it("throws an Fr24RequestError with status 404 when the flight is not found", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getFlightTrack } = await import("./flightTrack");
    const { Fr24RequestError } = await import("../../lib/fr24/errors");

    await expect(getFlightTrack("does-not-exist")).rejects.toThrow(
      Fr24RequestError,
    );
  });
});
