import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createMemoryLocalStorage(): Storage {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("getTrackedFlightNumber", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when no flight number has been saved", async () => {
    const { getTrackedFlightNumber } = await import("./storage");

    expect(getTrackedFlightNumber()).toBeNull();
  });

  it("returns the flight number previously saved with setTrackedFlightNumber", async () => {
    const { getTrackedFlightNumber, setTrackedFlightNumber } = await import("./storage");

    setTrackedFlightNumber("BA285");

    expect(getTrackedFlightNumber()).toBe("BA285");
  });
});

describe("getCachedFlightTrack", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when nothing has been cached", async () => {
    const { getCachedFlightTrack } = await import("./storage");

    expect(getCachedFlightTrack("BA285")).toBeNull();
  });

  it("returns the track and record previously saved with setCachedFlightTrack for the same flight number", async () => {
    const { getCachedFlightTrack, setCachedFlightTrack } = await import("./storage");
    const track = [
      {
        timestamp: "2026-09-12T00:00:00Z",
        lat: 51.5,
        lon: -0.1,
        alt: 35000,
        gspeed: 480,
        vspeed: 0,
        track: 90,
        squawk: "1000",
        callsign: "BAW285",
        source: "ADSB",
      },
    ];
    const record = {
      fr24_id: "391fdd79",
      flight: "BA285",
      callsign: "BAW285",
      orig_icao: "EGLL",
      dest_icao: "OMDB",
      flight_ended: false,
    };

    setCachedFlightTrack("BA285", track, record);

    expect(getCachedFlightTrack("BA285")).toEqual({ track, record });
  });

  it("returns null when the cached track belongs to a different flight number", async () => {
    const { getCachedFlightTrack, setCachedFlightTrack } = await import("./storage");

    setCachedFlightTrack("BA285", [], null);

    expect(getCachedFlightTrack("EZY123")).toBeNull();
  });
});
