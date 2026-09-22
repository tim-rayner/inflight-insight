import type { TrackPoint } from "@/app/actions/flightTrack";
import type { FlightCallabilityResult } from "@/app/actions/flight";
import type { FlightSummaryRecord } from "@/lib/fr24/callsign";

export type ResolveFlightRouteResult =
  | { status: "found"; track: TrackPoint[]; record: FlightSummaryRecord | null }
  | { status: "not-callable" }
  | { status: "no-track" }
  | { status: "error"; message: string };

export async function resolveFlightRoute(flightNumber: string): Promise<ResolveFlightRouteResult> {
  const flightResponse = await fetch("/api/flight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flightNumber }),
  });

  if (!flightResponse.ok) {
    const errorPayload = (await flightResponse.json()) as { error: string };
    return { status: "error", message: errorPayload.error };
  }

  const flightPayload = (await flightResponse.json()) as { data: FlightCallabilityResult };
  const record = flightPayload.data.record;
  const fr24Id = record?.fr24_id;

  if (!flightPayload.data.callable || !fr24Id) {
    return { status: "not-callable" };
  }

  const trackResponse = await fetch("/api/flight/flight-track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fr24Id }),
  });
  if (!trackResponse.ok) {
    const errorPayload = (await trackResponse.json()) as { error: string };
    return { status: "error", message: errorPayload.error };
  }

  const trackPayload = (await trackResponse.json()) as { data: { track: TrackPoint[] } };
  const track = trackPayload.data.track;

  if (track.length === 0) {
    return { status: "no-track" };
  }

  return { status: "found", track, record: record ?? null };
}
