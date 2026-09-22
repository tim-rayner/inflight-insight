import { describe, expect, it } from "vitest";
import type { TrackPoint } from "@/features/flight-track/lib/getFlightTrack";

function trackPoint(overrides: Partial<TrackPoint>): TrackPoint {
  return {
    timestamp: "2026-09-12T10:20:00Z",
    lat: 0,
    lon: 0,
    alt: 0,
    gspeed: 0,
    vspeed: 0,
    track: 0,
    squawk: "",
    callsign: null,
    source: "",
    ...overrides,
  };
}

describe("estimateCurrentSpeedMetersPerSecond", () => {
  it("derives speed from the distance and elapsed time between the last two points", async () => {
    const { estimateCurrentSpeedMetersPerSecond } = await import("./planeAnimation");

    // Roughly 1 degree of longitude at the equator is ~111.2km; 60 seconds
    // apart gives a speed of ~1853 m/s (unrealistically fast, but exact and
    // easy to check the arithmetic against).
    const track: TrackPoint[] = [
      trackPoint({ lat: 0, lon: 0, timestamp: "2026-09-12T10:00:00Z" }),
      trackPoint({ lat: 0, lon: 1, timestamp: "2026-09-12T10:01:00Z" }),
    ];

    const speed = estimateCurrentSpeedMetersPerSecond(track);

    expect(speed).toBeGreaterThan(1800);
    expect(speed).toBeLessThan(1900);
  });

  it("falls back to a default when fewer than two points are available", async () => {
    const { estimateCurrentSpeedMetersPerSecond } = await import("./planeAnimation");

    expect(estimateCurrentSpeedMetersPerSecond([trackPoint({})])).toBe(230);
    expect(estimateCurrentSpeedMetersPerSecond([])).toBe(230);
  });

  it("falls back to a default when the two points share a timestamp", async () => {
    const { estimateCurrentSpeedMetersPerSecond } = await import("./planeAnimation");

    const track: TrackPoint[] = [
      trackPoint({ lat: 0, lon: 0, timestamp: "2026-09-12T10:00:00Z" }),
      trackPoint({ lat: 0, lon: 1, timestamp: "2026-09-12T10:00:00Z" }),
    ];

    expect(estimateCurrentSpeedMetersPerSecond(track)).toBe(230);
  });
});

describe("extrapolatePosition", () => {
  it("stays at the origin when no time has elapsed", async () => {
    const { extrapolatePosition } = await import("./planeAnimation");

    const origin = { lat: 51.5, lon: -0.1 };
    const result = extrapolatePosition(origin, 90, 230, 0);

    expect(result.lat).toBeCloseTo(origin.lat, 9);
    expect(result.lon).toBeCloseTo(origin.lon, 9);
  });

  it("moves forward along the heading proportional to elapsed time and speed", async () => {
    const { extrapolatePosition } = await import("./planeAnimation");
    const { haversineDistanceMeters, initialBearingDegrees } = await import("./geo");

    const origin = { lat: 40, lon: -74 };
    const speedMetersPerSecond = 250;
    const elapsedMs = 30_000;

    const result = extrapolatePosition(origin, 63, speedMetersPerSecond, elapsedMs);

    expect(haversineDistanceMeters(origin, result)).toBeCloseTo(speedMetersPerSecond * (elapsedMs / 1000), -1);
    expect(initialBearingDegrees(origin, result)).toBeCloseTo(63, 3);
  });

  it("clamps elapsed time to MAX_EXTRAPOLATION_MS so a long gap freezes rather than runs away", async () => {
    const { extrapolatePosition, MAX_EXTRAPOLATION_MS } = await import("./planeAnimation");
    const { haversineDistanceMeters } = await import("./geo");

    const origin = { lat: 40, lon: -74 };
    const speedMetersPerSecond = 250;

    const atCap = extrapolatePosition(origin, 63, speedMetersPerSecond, MAX_EXTRAPOLATION_MS);
    const wellPastCap = extrapolatePosition(origin, 63, speedMetersPerSecond, MAX_EXTRAPOLATION_MS * 10);

    expect(haversineDistanceMeters(atCap, wellPastCap)).toBeCloseTo(0, 3);
  });

  it("never moves backward for a negative elapsed time", async () => {
    const { extrapolatePosition } = await import("./planeAnimation");

    const origin = { lat: 40, lon: -74 };
    const result = extrapolatePosition(origin, 63, 250, -1000);

    expect(result.lat).toBeCloseTo(origin.lat, 9);
    expect(result.lon).toBeCloseTo(origin.lon, 9);
  });
});
