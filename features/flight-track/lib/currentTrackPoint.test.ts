import { describe, expect, it } from "vitest";
import type { TrackPoint } from "@/features/flight-track/lib/getFlightTrack";
import { currentTrackPoint } from "./currentTrackPoint";

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

describe("currentTrackPoint", () => {
  it("returns the last point on the track", () => {
    const latest = trackPoint({ lat: 51.5, lon: -0.1, timestamp: "2026-09-12T10:21:00Z" });
    const track = [trackPoint({ lat: 51.47, lon: -0.46 }), latest];

    expect(currentTrackPoint(track)).toBe(latest);
  });

  it("returns the only point when the track has a single checkpoint", () => {
    const only = trackPoint({ lat: 40.64, lon: -73.78 });

    expect(currentTrackPoint([only])).toBe(only);
  });

  it("returns undefined for an empty track", () => {
    expect(currentTrackPoint([])).toBeUndefined();
  });
});
