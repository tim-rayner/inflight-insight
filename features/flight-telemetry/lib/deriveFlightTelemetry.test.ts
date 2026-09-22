import { describe, expect, it } from "vitest";
import type { TrackPoint } from "@/features/flight-track/lib/getFlightTrack";
import type { FlightSummaryRecord } from "@/shared/fr24/callsign";
import { deriveFlightTelemetry, liveFlightMetrics } from "./deriveFlightTelemetry";

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

function record(overrides: Partial<FlightSummaryRecord> = {}): FlightSummaryRecord {
  return {
    fr24_id: "391fdd79",
    flight: "BA285",
    callsign: "BAW285",
    orig_icao: "EGLL",
    dest_icao: "KJFK",
    datetime_takeoff: "2026-09-12T10:00:00Z",
    flight_ended: false,
    ...overrides,
  };
}

describe("deriveFlightTelemetry", () => {
  it("returns undefined when there is no track or no checkpoints", () => {
    expect(
      deriveFlightTelemetry({
        flightNumber: "BA285",
        track: null,
        record: null,
      }),
    ).toBeUndefined();

    expect(
      deriveFlightTelemetry({
        flightNumber: "BA285",
        track: [],
        record: null,
      }),
    ).toBeUndefined();
  });

  it("publishes last-reported location as lat/lng and the rest of the telemetry snapshot", () => {
    const telemetry = deriveFlightTelemetry({
      flightNumber: "BA285",
      track: [
        trackPoint({
          lat: 0,
          lon: 0,
          timestamp: "2026-09-12T10:00:00Z",
          gspeed: 400,
        }),
        trackPoint({
          lat: 1,
          lon: 0,
          timestamp: "2026-09-12T11:59:00Z",
          alt: 36_000,
          gspeed: 450,
          vspeed: 800,
          track: 95,
          squawk: "1234",
          source: "ADS-B",
        }),
      ],
      record: record(),
    });

    expect(telemetry?.location).toEqual({ lat: 1, lng: 0 });
    expect(telemetry?.flightNumber).toBe("BA285");
    expect(telemetry?.callsign).toBe("BAW285");
    expect(telemetry?.showCallsign).toBe(true);
    expect(telemetry?.route).toBe("EGLL → KJFK");
    expect(telemetry?.groundSpeedKt).toBe(450);
    expect(telemetry?.altitudeFt).toBe(36_000);
    expect(telemetry?.headingDegrees).toBe(95);
    expect(telemetry?.verticalSpeedFtPerMin).toBe(800);
    expect(telemetry?.verticalRate).toBe("climbing");
    expect(telemetry?.departedIso).toBe("2026-09-12T10:00:00Z");
    expect(telemetry?.lastReportedIso).toBe("2026-09-12T11:59:00Z");
    expect(telemetry?.squawk).toBe("1234");
    expect(telemetry?.source).toBe("ADS-B");
    expect(telemetry?.distanceFlownNm).toBeCloseTo(60, 0);
  });

  it("hides callsign when it matches the flight number", () => {
    const telemetry = deriveFlightTelemetry({
      flightNumber: "BAW285",
      track: [trackPoint()],
      record: record({ callsign: "BAW285" }),
    });

    expect(telemetry?.showCallsign).toBe(false);
  });
});

describe("liveFlightMetrics", () => {
  const nowMs = Date.parse("2026-09-12T12:00:00Z");

  it("derives airborne time, staleness, and average speed from the snapshot clock", () => {
    const telemetry = deriveFlightTelemetry({
      flightNumber: "BA285",
      track: [
        trackPoint({ lat: 0, lon: 0, timestamp: "2026-09-12T10:00:00Z" }),
        trackPoint({ lat: 1, lon: 0, timestamp: "2026-09-12T11:59:00Z", gspeed: 450 }),
      ],
      record: record(),
    });

    expect(telemetry).toBeDefined();
    const live = liveFlightMetrics(telemetry!, nowMs);

    expect(live.airborneMs).toBe(2 * 3_600_000);
    expect(live.lastUpdateMs).toBe(60_000);
    expect(live.averageSpeedKt).toBeCloseTo(30, 0);
  });

  it("uses reported ground speed for average when airborne time is still negligible", () => {
    const takeoff = "2026-09-12T12:00:00Z";
    const telemetry = deriveFlightTelemetry({
      flightNumber: "BA285",
      track: [trackPoint({ timestamp: takeoff, gspeed: 180 })],
      record: record({ datetime_takeoff: takeoff }),
    });

    expect(liveFlightMetrics(telemetry!, nowMs).averageSpeedKt).toBe(180);
  });
});
