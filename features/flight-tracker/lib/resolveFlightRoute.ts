"use server";

import { checkFlightCallable } from "@/features/flight-lookup/lib/checkFlightCallable";
import { getFlightTrack } from "@/features/flight-track/lib/getFlightTrack";
import type { TrackPoint } from "@/features/flight-track/lib/getFlightTrack";
import type { FlightSummaryRecord } from "@/shared/fr24/callsign";
import { Fr24RequestError } from "@/shared/fr24/errors";

export type ResolveFlightRouteResult =
  | { status: "found"; track: TrackPoint[]; record: FlightSummaryRecord | null }
  | { status: "not-callable" }
  | { status: "no-track" }
  | { status: "error"; message: string };

export async function resolveFlightRoute(flightNumber: string): Promise<ResolveFlightRouteResult> {
  if (typeof flightNumber !== "string" || flightNumber.trim() === "") {
    return { status: "error", message: "flightNumber is required and must be a string" };
  }

  try {
    const result = await checkFlightCallable(flightNumber);
    const record = result.record;
    const fr24Id = record?.fr24_id;

    if (!result.callable || !fr24Id) {
      return { status: "not-callable" };
    }

    const { track } = await getFlightTrack(fr24Id);

    if (track.length === 0) {
      return { status: "no-track" };
    }

    return { status: "found", track, record: record ?? null };
  } catch (error) {
    if (error instanceof Fr24RequestError || error instanceof Error) {
      return { status: "error", message: error.message };
    }

    return { status: "error", message: "Unknown error" };
  }
}
