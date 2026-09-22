import { describe, expect, it } from "vitest";
import { extractOperationalCallsign, type FlightSummaryRecord } from "./callsign";

function makeRecord(overrides: Partial<FlightSummaryRecord>): FlightSummaryRecord {
  return {
    fr24_id: "391fdd79",
    flight: "BA285",
    callsign: "BAW285",
    operating_as: "BAW",
    painted_as: "BAW",
    orig_icao: "EGLL",
    dest_icao: "KORD",
    datetime_takeoff: "2026-09-12T10:20:00Z",
    datetime_landed: null,
    first_seen: "2026-09-12T10:20:00Z",
    last_seen: "2026-09-12T12:50:00Z",
    flight_ended: false,
    ...overrides,
  };
}

describe("extractOperationalCallsign", () => {
  it("returns the callsign and record from the most recent (first) entry", () => {
    const recent = makeRecord({ callsign: "BAW285" });
    const older = makeRecord({ callsign: "BAW285", first_seen: "2026-09-11T10:20:00Z" });

    const result = extractOperationalCallsign([recent, older]);

    expect(result.callsign).toBe("BAW285");
    expect(result.record).toEqual(recent);
  });

  it("returns nulls when there are no records", () => {
    const result = extractOperationalCallsign([]);

    expect(result.callsign).toBeNull();
    expect(result.record).toBeNull();
  });

  it("returns a null callsign when the record's callsign field is null", () => {
    const record = makeRecord({ callsign: null });

    const result = extractOperationalCallsign([record]);

    expect(result.callsign).toBeNull();
    expect(result.record).toEqual(record);
  });
});
