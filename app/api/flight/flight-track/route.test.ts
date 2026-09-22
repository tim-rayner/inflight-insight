import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../actions/flightTrack", () => ({
  getFlightTrack: vi.fn(),
}));

import { getFlightTrack } from "../../../actions/flightTrack";
import { Fr24RequestError } from "../../../../lib/fr24/errors";
import { POST } from "./route";

const getFlightTrackMock = vi.mocked(getFlightTrack);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/flight/flight-track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/flight/flight-track", () => {
  beforeEach(() => {
    getFlightTrackMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the track points for a valid fr24Id", async () => {
    getFlightTrackMock.mockResolvedValue({
      fr24Id: "391fdd79",
      track: [
        {
          timestamp: "2026-09-12T10:20:00Z",
          lat: 51.4706,
          lon: -0.4619,
          alt: 1200,
          gspeed: 180,
          vspeed: 1500,
          track: 270,
          squawk: "1000",
          callsign: "BAW285",
          source: "ADSB",
        },
      ],
    });

    const response = await POST(makeRequest({ fr24Id: "391fdd79" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.fr24Id).toBe("391fdd79");
    expect(json.data.track).toHaveLength(1);
    expect(getFlightTrackMock).toHaveBeenCalledWith("391fdd79");
  });

  it("returns 400 when fr24Id is missing", async () => {
    const response = await POST(makeRequest({}));

    expect(response.status).toBe(400);
    expect(getFlightTrackMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the request body is not valid JSON", async () => {
    const request = new Request("http://localhost/api/flight/flight-track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(getFlightTrackMock).not.toHaveBeenCalled();
  });

  it("returns 404 when FR24 reports the flight was not found", async () => {
    getFlightTrackMock.mockRejectedValue(
      new Fr24RequestError(404, "FR24 flight tracks request failed: 404 Not Found"),
    );

    const response = await POST(makeRequest({ fr24Id: "does-not-exist" }));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toMatch(/Not Found/);
  });

  it("returns 500 when the FR24 API token is not configured", async () => {
    getFlightTrackMock.mockRejectedValue(
      new Error("FR24 API token is not configured"),
    );

    const response = await POST(makeRequest({ fr24Id: "391fdd79" }));

    expect(response.status).toBe(500);
  });

  it("returns 500 when FR24 rejects the request as unauthorized", async () => {
    getFlightTrackMock.mockRejectedValue(
      new Fr24RequestError(401, "FR24 flight tracks request failed: 401 Unauthorized"),
    );

    const response = await POST(makeRequest({ fr24Id: "391fdd79" }));

    expect(response.status).toBe(500);
  });

  it("returns 502 for other upstream FR24 errors", async () => {
    getFlightTrackMock.mockRejectedValue(
      new Fr24RequestError(402, "FR24 flight tracks request failed: 402 Payment Required"),
    );

    const response = await POST(makeRequest({ fr24Id: "391fdd79" }));
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json.error).toMatch(/Payment Required/);
  });
});
