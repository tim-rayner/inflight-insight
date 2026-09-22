import type { TrackPoint } from "@/app/actions/flightTrack";
import { destinationPoint, haversineDistanceMeters, type LatLon } from "@/lib/flightTracking/geo";

// Once a checkpoint is this stale, stop dead-reckoning it any further
// forward — most likely the flight has landed, gone out of coverage, or
// polling has stalled, and an extrapolation run unboundedly off the last
// known heading would eventually put the plane somewhere absurd.
export const MAX_EXTRAPOLATION_MS = 10 * 60_000;

// Used only when we can't derive a real speed from timestamps, e.g. a track
// with a single point — a rough mid-cruise jet ground speed.
const FALLBACK_SPEED_METERS_PER_SECOND = 230;

// Uses the plane's own last two reported positions — rather than a poll
// timer — as the source of truth for how fast it's currently moving, so the
// animation pace tracks reality even if the poll cadence drifts.
export function estimateCurrentSpeedMetersPerSecond(track: TrackPoint[]): number {
  if (track.length < 2) return FALLBACK_SPEED_METERS_PER_SECOND;

  const previous = track[track.length - 2];
  const current = track[track.length - 1];
  const elapsedSeconds =
    (new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime()) / 1000;

  if (elapsedSeconds <= 0) return FALLBACK_SPEED_METERS_PER_SECOND;

  const speed = haversineDistanceMeters(previous, current) / elapsedSeconds;
  return speed > 0 ? speed : FALLBACK_SPEED_METERS_PER_SECOND;
}

// Where the plane must be *right now*, dead-reckoned forward from its last
// confirmed checkpoint along the heading and speed derived from the last two
// checkpoints on record — this is what keeps the plane moving continuously
// between polls, rather than sitting frozen at the last confirmed point
// until the next one lands. Elapsed time is clamped to MAX_EXTRAPOLATION_MS
// so a long polling gap freezes the estimate instead of running away.
export function extrapolatePosition(
  origin: LatLon,
  bearingDegrees: number,
  speedMetersPerSecond: number,
  elapsedMs: number,
): LatLon {
  const cappedElapsedMs = Math.min(Math.max(elapsedMs, 0), MAX_EXTRAPOLATION_MS);
  const distanceMeters = speedMetersPerSecond * (cappedElapsedMs / 1000);
  return destinationPoint(origin, bearingDegrees, distanceMeters);
}
