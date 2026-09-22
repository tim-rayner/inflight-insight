import type { TrackPoint } from "@/app/actions/flightTrack";

const EARTH_RADIUS_NM = 3440.065;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceNm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;

  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function trackDistanceNm(track: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < track.length; i++) {
    total += haversineDistanceNm(track[i - 1], track[i]);
  }
  return total;
}

const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export function compassDirection(headingDegrees: number): string {
  const normalized = ((headingDegrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return COMPASS_POINTS[index];
}

export type VerticalRateStatus = "climbing" | "descending" | "level";

const LEVEL_THRESHOLD_FT_PER_MIN = 150;

export function verticalRateStatus(vspeed: number): VerticalRateStatus {
  if (vspeed > LEVEL_THRESHOLD_FT_PER_MIN) return "climbing";
  if (vspeed < -LEVEL_THRESHOLD_FT_PER_MIN) return "descending";
  return "level";
}

// Rounds to the minute; a negative or sub-minute duration reads as "0m" rather than going negative.
export function formatDurationShort(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours === 0 ? `${minutes}m` : `${hours}h ${minutes}m`;
}

export function formatSecondsAgo(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s ago`;
  return `${formatDurationShort(ms)} ago`;
}
