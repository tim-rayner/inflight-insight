import "server-only";

import { getFr24Headers } from "@/shared/fr24/auth";
import { extractOperationalCallsign } from "@/shared/fr24/callsign";
import { Fr24RequestError } from "@/shared/fr24/errors";
import type { FlightSummaryRecord } from "@/shared/fr24/callsign";

const FLIGHT_SUMMARY_URL = "https://fr24api.flightradar24.com/api/flight-summary/light";
const LOOKBACK_HOURS = 24;

export interface FlightCallabilityResult {
  callable: boolean;
  callsign: string | null;
  record: FlightSummaryRecord | null;
}

function isoNoMillis(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export async function checkFlightCallable(
  flightNumber: string,
): Promise<FlightCallabilityResult> {
  const headers = getFr24Headers({ apiToken: process.env.FR24_API_TOKEN ?? "" });

  const now = new Date();
  const from = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);

  const url = new URL(FLIGHT_SUMMARY_URL);
  url.searchParams.set("flights", flightNumber);
  url.searchParams.set("flight_datetime_from", isoNoMillis(from));
  url.searchParams.set("flight_datetime_to", isoNoMillis(now));
  url.searchParams.set("sort", "desc");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Fr24RequestError(
      response.status,
      `FR24 flight summary request failed: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as { data?: FlightSummaryRecord[] };
  const records = Array.isArray(payload.data) ? payload.data : [];

  const { callsign, record } = extractOperationalCallsign(records);

  return {
    callable: record !== null && record.flight_ended !== true,
    callsign,
    record,
  };
}
