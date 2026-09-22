import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("resolveFlightRoute", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a found result with the flight's track when the flight is callable", async () => {
    const track = [
      {
        timestamp: "2026-09-12T10:20:00Z",
        lat: 51.4775,
        lon: -0.4614,
        alt: 0,
        gspeed: 0,
        vspeed: 0,
        track: 0,
        squawk: "",
        callsign: "BAW285",
        source: "ADSB",
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/flight") {
        return {
          ok: true,
          json: async () => ({
            data: {
              callable: true,
              callsign: "BAW285",
              record: { fr24_id: "391fdd79", orig_icao: "EGLL", dest_icao: "OMDB" },
            },
          }),
        };
      }

      if (url === "/api/flight/flight-track") {
        return {
          ok: true,
          json: async () => ({
            data: { fr24Id: "391fdd79", track },
          }),
        };
      }

      throw new Error(`Unexpected fetch to ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { resolveFlightRoute } = await import("./resolveFlightRoute");

    const result = await resolveFlightRoute("BA285");

    expect(result).toEqual({
      status: "found",
      track,
      record: { fr24_id: "391fdd79", orig_icao: "EGLL", dest_icao: "OMDB" },
    });
  });

  it("returns a not-callable result when the flight is not currently trackable", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: { callable: false, callsign: null, record: null },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { resolveFlightRoute } = await import("./resolveFlightRoute");

    const result = await resolveFlightRoute("BA285");

    expect(result).toEqual({ status: "not-callable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a no-track result when the flight is callable but has an empty track", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/flight") {
        return {
          ok: true,
          json: async () => ({
            data: {
              callable: true,
              callsign: "BAW285",
              record: { fr24_id: "391fdd79" },
            },
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({ data: { fr24Id: "391fdd79", track: [] } }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { resolveFlightRoute } = await import("./resolveFlightRoute");

    const result = await resolveFlightRoute("BA285");

    expect(result).toEqual({ status: "no-track" });
  });

  it("returns an error result with the server's message when /api/flight responds with an error", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: "flightNumber is required and must be a string" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { resolveFlightRoute } = await import("./resolveFlightRoute");

    const result = await resolveFlightRoute("");

    expect(result).toEqual({
      status: "error",
      message: "flightNumber is required and must be a string",
    });
  });

  it("returns an error result with the server's message when /api/flight/flight-track responds with an error", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/flight") {
        return {
          ok: true,
          json: async () => ({
            data: {
              callable: true,
              callsign: "BAW285",
              record: { fr24_id: "391fdd79" },
            },
          }),
        };
      }

      return {
        ok: false,
        json: async () => ({ error: "fr24Id is required and must be a string" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { resolveFlightRoute } = await import("./resolveFlightRoute");

    const result = await resolveFlightRoute("BA285");

    expect(result).toEqual({
      status: "error",
      message: "fr24Id is required and must be a string",
    });
  });
});
