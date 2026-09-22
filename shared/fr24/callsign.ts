export interface FlightSummaryRecord {
  fr24_id: string;
  flight: string | null;
  callsign: string | null;
  operating_as?: string | null;
  painted_as?: string | null;
  orig_icao?: string | null;
  dest_icao?: string | null;
  datetime_takeoff?: string | null;
  datetime_landed?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  flight_ended: boolean | null;
  [key: string]: unknown;
}

export interface OperationalCallsign {
  callsign: string | null;
  record: FlightSummaryRecord | null;
}

/**
 * extracts the most recent operational callsign from a list of flight summary records
 * @param records - list of flight summary records
 * @returns OperationalCallsign - operational callsign and record
 */
export function extractOperationalCallsign(
  records: FlightSummaryRecord[],
): OperationalCallsign {
  const [mostRecent] = records;

  if (!mostRecent) {
    return { callsign: null, record: null };
  }

  return { callsign: mostRecent.callsign ?? null, record: mostRecent };
}
