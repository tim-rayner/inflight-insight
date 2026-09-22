import { describe, expect, it } from "vitest";

describe("haversineDistanceMeters", () => {
  it("returns 0 for identical points", async () => {
    const { haversineDistanceMeters } = await import("./geo");

    expect(haversineDistanceMeters({ lat: 51.5074, lon: -0.1278 }, { lat: 51.5074, lon: -0.1278 })).toBe(0);
  });

  it("matches the known great-circle distance between London and Paris", async () => {
    const { haversineDistanceMeters } = await import("./geo");

    const london = { lat: 51.5074, lon: -0.1278 };
    const paris = { lat: 48.8566, lon: 2.3522 };

    // Accepted great-circle distance is ~343.5km; allow a small tolerance
    // for the spherical-earth approximation.
    expect(haversineDistanceMeters(london, paris)).toBeGreaterThan(340_000);
    expect(haversineDistanceMeters(london, paris)).toBeLessThan(347_000);
  });
});

describe("lerp", () => {
  it("interpolates linearly between two values", async () => {
    const { lerp } = await import("./geo");

    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(10, 0, 0.25)).toBe(7.5);
  });
});

describe("lerpAngleDegrees", () => {
  it("interpolates directly when there's no wraparound", async () => {
    const { lerpAngleDegrees } = await import("./geo");

    expect(lerpAngleDegrees(10, 20, 0.5)).toBe(15);
  });

  it("sweeps through 0/360 when that's the shorter direction", async () => {
    const { lerpAngleDegrees } = await import("./geo");

    expect(lerpAngleDegrees(350, 10, 0.5)).toBe(0);
  });

  it("normalizes the result into [0, 360)", async () => {
    const { lerpAngleDegrees } = await import("./geo");

    expect(lerpAngleDegrees(350, 10, 1)).toBe(10);
    expect(lerpAngleDegrees(350, 10, 0)).toBe(350);
  });
});

describe("initialBearingDegrees", () => {
  it("returns 90 (east) for two points on the same parallel", async () => {
    const { initialBearingDegrees } = await import("./geo");

    expect(initialBearingDegrees({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(90, 5);
  });

  it("returns 0 (north) for two points on the same meridian", async () => {
    const { initialBearingDegrees } = await import("./geo");

    expect(initialBearingDegrees({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(0, 5);
  });

  it("returns 180 (south) heading the other way", async () => {
    const { initialBearingDegrees } = await import("./geo");

    expect(initialBearingDegrees({ lat: 1, lon: 0 }, { lat: 0, lon: 0 })).toBeCloseTo(180, 5);
  });
});

describe("destinationPoint", () => {
  it("returns the start point unchanged for zero distance", async () => {
    const { destinationPoint } = await import("./geo");

    const start = { lat: 51.5, lon: -0.1 };
    const result = destinationPoint(start, 45, 0);

    expect(result.lat).toBeCloseTo(start.lat, 9);
    expect(result.lon).toBeCloseTo(start.lon, 9);
  });

  it("moves due north along the meridian for a 0deg bearing", async () => {
    const { destinationPoint } = await import("./geo");

    const result = destinationPoint({ lat: 0, lon: 0 }, 0, 111_195); // ~1 degree of latitude

    expect(result.lat).toBeCloseTo(1, 1);
    expect(result.lon).toBeCloseTo(0, 5);
  });

  it("round-trips with initialBearingDegrees and haversineDistanceMeters", async () => {
    const { destinationPoint, initialBearingDegrees, haversineDistanceMeters } = await import("./geo");

    const start = { lat: 40, lon: -74 };
    const bearing = 63;
    const distanceMeters = 250_000;

    const destination = destinationPoint(start, bearing, distanceMeters);

    expect(haversineDistanceMeters(start, destination)).toBeCloseTo(distanceMeters, -1);
    expect(initialBearingDegrees(start, destination)).toBeCloseTo(bearing, 3);
  });
});
