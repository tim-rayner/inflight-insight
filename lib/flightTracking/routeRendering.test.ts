import { describe, expect, it } from "vitest";
import type { TrackPoint } from "@/app/actions/flightTrack";

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

describe("originGeoJSON", () => {
  it("places a single origin point at the track's first coordinate", async () => {
    const { originGeoJSON } = await import("./routeRendering");

    const track: TrackPoint[] = [
      trackPoint({ lat: 51.5, lon: -0.1 }),
      trackPoint({ lat: 52, lon: 1 }),
    ];

    const result = originGeoJSON(track);

    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry.coordinates).toEqual([-0.1, 51.5]);
  });
});

describe("routeLineFeature", () => {
  it("appends the live tip after every settled point", async () => {
    const { routeLineFeature } = await import("./routeRendering");

    const settledPoints: TrackPoint[] = [
      trackPoint({ lat: 51.5, lon: -0.1 }),
      trackPoint({ lat: 52, lon: 1 }),
    ];
    const tip = { lat: 52.5, lon: 2 };

    const result = routeLineFeature(settledPoints, tip);

    expect(result.geometry.coordinates).toEqual([
      [-0.1, 51.5],
      [1, 52],
      [2, 52.5],
    ]);
  });
});

describe("headingReferencePoint", () => {
  it("sits behind the position along the opposite of its heading", async () => {
    const { headingReferencePoint } = await import("./routeRendering");
    const { haversineDistanceMeters, initialBearingDegrees } = await import("./geo");

    const position = { lat: 40, lon: -74 };
    const bearingDegrees = 90;

    const result = headingReferencePoint(position, bearingDegrees);

    expect(haversineDistanceMeters(position, result)).toBeCloseTo(200, 0);
    expect(initialBearingDegrees(position, result)).toBeCloseTo(270, 0);
  });
});
