import { afterEach, describe, expect, it, vi } from "vitest";
import { checkFlightCallable } from "@/features/flight-lookup/lib/checkFlightCallable";
import { getFlightTrack } from "@/features/flight-track/lib/getFlightTrack";
import { Fr24RequestError } from "@/shared/fr24/errors";
import { resolveFlightRoute } from "./resolveFlightRoute";

vi.mock("@/features/flight-lookup/lib/checkFlightCallable", () => ({
  checkFlightCallable: vi.fn(),
}));
vi.mock("@/features/flight-track/lib/getFlightTrack", () => ({
  getFlightTrack: vi.fn(),
}));

const checkFlightCallableMock = vi.mocked(checkFlightCallable);
const getFlightTrackMock = vi.mocked(getFlightTrack);

afterEach(() => {
  vi.clearAllMocks();
});

describe("resolveFlightRoute", () => {
  it("returns a found result with the flight's track when the flight is callable", async () => {
    const track = [
      {
        timestamp: "2026-09-12T10:20:00Z",
        lat: 51.4775,
        lon: -0.4614,
        alt: 0,
        gspeed: 0,
        vspeed: 0,
        track: 0,
        squawk: "",
        callsign: "BAW285",
        source: "ADSB",
      },
    ];
    const record = {
      fr24_id: "391fdd79",
      flight: "BA285",
      callsign: "BAW285",
      flight_ended: false,
      orig_icao: "EGLL",
      dest_icao: "OMDB",
    };

    checkFlightCallableMock.mockResolvedValue({
      callable: true,
      callsign: "BAW285",
      record,
    });
    getFlightTrackMock.mockResolvedValue({
      fr24Id: "391fdd79",
      track,
    });

    const result = await resolveFlightRoute("BA285");

    expect(result).toEqual({
      status: "found",
      track,
      record,
    });
    expect(checkFlightCallableMock).toHaveBeenCalledWith("BA285");
    expect(getFlightTrackMock).toHaveBeenCalledWith("391fdd79");
  });

  it("returns a not-callable result when the flight is not currently trackable", async () => {
    checkFlightCallableMock.mockResolvedValue({
      callable: false,
      callsign: null,
      record: null,
    });

    const result = await resolveFlightRoute("BA285");

    expect(result).toEqual({ status: "not-callable" });
    expect(getFlightTrackMock).not.toHaveBeenCalled();
  });

  it("returns a no-track result when the flight is callable but has an empty track", async () => {
    checkFlightCallableMock.mockResolvedValue({
      callable: true,
      callsign: "BAW285",
      record: {
        fr24_id: "391fdd79",
        flight: "BA285",
        callsign: "BAW285",
        flight_ended: false,
      },
    });
    getFlightTrackMock.mockResolvedValue({
      fr24Id: "391fdd79",
      track: [],
    });

    const result = await resolveFlightRoute("BA285");

    expect(result).toEqual({ status: "no-track" });
  });

  it("returns an error result when flightNumber is empty", async () => {
    const result = await resolveFlightRoute("");

    expect(result).toEqual({
      status: "error",
      message: "flightNumber is required and must be a string",
    });
    expect(checkFlightCallableMock).not.toHaveBeenCalled();
    expect(getFlightTrackMock).not.toHaveBeenCalled();
  });

  it("returns an error result when checkFlightCallable throws Fr24RequestError", async () => {
    checkFlightCallableMock.mockRejectedValue(
      new Fr24RequestError(502, "FR24 flight summary request failed: 502 Bad Gateway"),
    );

    const result = await resolveFlightRoute("BA285");

    expect(result).toEqual({
      status: "error",
      message: "FR24 flight summary request failed: 502 Bad Gateway",
    });
    expect(getFlightTrackMock).not.toHaveBeenCalled();
  });

  it("returns an error result when checkFlightCallable throws Error", async () => {
    checkFlightCallableMock.mockRejectedValue(new Error("FR24 API token is not configured"));

    const result = await resolveFlightRoute("BA285");

    expect(result).toEqual({
      status: "error",
      message: "FR24 API token is not configured",
    });
    expect(getFlightTrackMock).not.toHaveBeenCalled();
  });

  it("returns an error result when getFlightTrack throws", async () => {
    checkFlightCallableMock.mockResolvedValue({
      callable: true,
      callsign: "BAW285",
      record: {
        fr24_id: "391fdd79",
        flight: "BA285",
        callsign: "BAW285",
        flight_ended: false,
      },
    });
    getFlightTrackMock.mockRejectedValue(new Error("fr24Id is required"));

    const result = await resolveFlightRoute("BA285");

    expect(result).toEqual({
      status: "error",
      message: "fr24Id is required",
    });
  });
});
