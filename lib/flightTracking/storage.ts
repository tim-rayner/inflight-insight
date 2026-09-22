import type { TrackPoint } from "@/app/actions/flightTrack";
import type { FlightSummaryRecord } from "@/lib/fr24/callsign";

const TRACKED_FLIGHT_NUMBER_KEY = "trackedFlightNumber";
const CACHED_FLIGHT_TRACK_KEY = "cachedFlightTrack";

export function getTrackedFlightNumber(): string | null {
  return localStorage.getItem(TRACKED_FLIGHT_NUMBER_KEY);
}

export function setTrackedFlightNumber(flightNumber: string): void {
  localStorage.setItem(TRACKED_FLIGHT_NUMBER_KEY, flightNumber);
}

export interface CachedFlightResult {
  track: TrackPoint[];
  record: FlightSummaryRecord | null;
}

interface CachedFlightTrack extends CachedFlightResult {
  flightNumber: string;
}

// Lets the UI render a last-known route immediately on refresh, ahead of the network fetch.
export function getCachedFlightTrack(flightNumber: string): CachedFlightResult | null {
  const raw = localStorage.getItem(CACHED_FLIGHT_TRACK_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CachedFlightTrack;
    return parsed.flightNumber === flightNumber ? { track: parsed.track, record: parsed.record ?? null } : null;
  } catch {
    return null;
  }
}

export function setCachedFlightTrack(
  flightNumber: string,
  track: TrackPoint[],
  record: FlightSummaryRecord | null,
): void {
  const payload: CachedFlightTrack = { flightNumber, track, record };
  localStorage.setItem(CACHED_FLIGHT_TRACK_KEY, JSON.stringify(payload));
}
