"use server";

import { getFr24Headers } from "@/shared/fr24/auth";
import { Fr24RequestError } from "@/shared/fr24/errors";

const FLIGHT_TRACKS_URL = "https://fr24api.flightradar24.com/api/flight-tracks";

export interface TrackPoint {
  timestamp: string;
  lat: number;
  lon: number;
  alt: number;
  gspeed: number;
  vspeed: number;
  track: number;
  squawk: string;
  callsign: string | null;
  source: string;
}

export interface FlightTrackResult {
  fr24Id: string;
  track: TrackPoint[];
}

export async function getFlightTrack(
  fr24Id: string,
): Promise<FlightTrackResult> {
  if (fr24Id.trim() === "") {
    throw new Error("fr24Id is required");
  }

  const headers = getFr24Headers({
    apiToken: process.env.FR24_API_TOKEN ?? "",
  });

  const url = new URL(FLIGHT_TRACKS_URL);
  url.searchParams.set("flight_id", fr24Id);

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Fr24RequestError(
      response.status,
      `FR24 flight tracks request failed: ${response.status} ${response.statusText}`,
    );
  }

  // This endpoint returns a top-level array with one entry per requested
  // fr24_id, e.g. `[{ fr24_id, tracks }]` — not a bare object.
  const payload = (await response.json()) as Array<{
    fr24_id: string;
    tracks?: TrackPoint[];
  }>;
  const entry = payload[0];

  return {
    fr24Id: entry?.fr24_id ?? fr24Id,
    track: Array.isArray(entry?.tracks) ? entry.tracks : [],
  };
}
