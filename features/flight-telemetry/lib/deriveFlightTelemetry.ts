import type { TrackPoint } from "@/features/flight-track/lib/getFlightTrack";
import { currentTrackPoint } from "@/features/flight-track/lib/currentTrackPoint";
import type { FlightSummaryRecord } from "@/shared/fr24/callsign";
import { trackDistanceNm, verticalRateStatus, type VerticalRateStatus } from "./telemetry";

export interface PlaneLocation {
  lat: number;
  lng: number;
}

export interface FlightTelemetry {
  flightNumber: string;
  callsign: string | null;
  showCallsign: boolean;
  route: string | null;
  location: PlaneLocation;
  groundSpeedKt: number;
  altitudeFt: number;
  headingDegrees: number;
  verticalSpeedFtPerMin: number;
  verticalRate: VerticalRateStatus;
  distanceFlownNm: number;
  departedIso: string;
  lastReportedIso: string;
  squawk: string;
  source: string;
}

interface DeriveFlightTelemetryInput {
  flightNumber: string;
  track: TrackPoint[] | null;
  record: FlightSummaryRecord | null;
}

const MIN_ELAPSED_HOURS_FOR_AVERAGE_SPEED = 0.01;

// Snapshot of the tracked flight's last-reported state. Poll-stable — no
// clock — so publishing it through React context doesn't re-render the map
// tree every second and tear down the plane animation loop.
export function deriveFlightTelemetry({
  flightNumber,
  track,
  record,
}: DeriveFlightTelemetryInput): FlightTelemetry | undefined {
  if (!track) return undefined;

  const current = currentTrackPoint(track);
  const first = track[0];
  if (!current || !first) return undefined;

  const callsign = record?.callsign ?? null;
  const showCallsign = Boolean(
    callsign && callsign.toUpperCase() !== flightNumber.toUpperCase(),
  );
  const route =
    record?.orig_icao && record?.dest_icao
      ? `${record.orig_icao} → ${record.dest_icao}`
      : null;

  return {
    flightNumber,
    callsign,
    showCallsign,
    route,
    location: { lat: current.lat, lng: current.lon },
    groundSpeedKt: current.gspeed,
    altitudeFt: current.alt,
    headingDegrees: current.track,
    verticalSpeedFtPerMin: current.vspeed,
    verticalRate: verticalRateStatus(current.vspeed),
    distanceFlownNm: trackDistanceNm(track),
    departedIso: record?.datetime_takeoff ?? first.timestamp,
    lastReportedIso: current.timestamp,
    squawk: current.squawk,
    source: current.source || "unknown",
  };
}

export interface LiveFlightMetrics {
  airborneMs: number;
  lastUpdateMs: number;
  averageSpeedKt: number;
}

export function liveFlightMetrics(telemetry: FlightTelemetry, nowMs: number): LiveFlightMetrics {
  const airborneMs = nowMs - new Date(telemetry.departedIso).getTime();
  const lastUpdateMs = nowMs - new Date(telemetry.lastReportedIso).getTime();
  const elapsedHours = airborneMs / 3_600_000;
  const averageSpeedKt =
    elapsedHours > MIN_ELAPSED_HOURS_FOR_AVERAGE_SPEED
      ? telemetry.distanceFlownNm / elapsedHours
      : telemetry.groundSpeedKt;

  return { airborneMs, lastUpdateMs, averageSpeedKt };
}
