import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../actions/flight", () => ({
  checkFlightCallable: vi.fn(),
}));

import { checkFlightCallable } from "../../actions/flight";
import { Fr24RequestError } from "../../../lib/fr24/errors";
import { POST } from "./route";

const checkFlightCallableMock = vi.mocked(checkFlightCallable);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/flight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/flight", () => {
  beforeEach(() => {
    checkFlightCallableMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the action's result for a valid flight number", async () => {
    checkFlightCallableMock.mockResolvedValue({
      callable: true,
      callsign: "BAW285",
      record: { fr24_id: "391fdd79", flight: "BA285", callsign: "BAW285", flight_ended: false },
    });

    const response = await POST(makeRequest({ flightNumber: "BA285" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      data: {
        callable: true,
        callsign: "BAW285",
        record: { fr24_id: "391fdd79", flight: "BA285", callsign: "BAW285", flight_ended: false },
      },
    });
    expect(checkFlightCallableMock).toHaveBeenCalledWith("BA285");
  });

  it("returns 400 when flightNumber is missing", async () => {
    const response = await POST(makeRequest({}));

    expect(response.status).toBe(400);
    expect(checkFlightCallableMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the request body is not valid JSON", async () => {
    const request = new Request("http://localhost/api/flight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(checkFlightCallableMock).not.toHaveBeenCalled();
  });

  it("returns 400 when FR24 rejects the request as a validation error", async () => {
    checkFlightCallableMock.mockRejectedValue(
      new Fr24RequestError(400, "FR24 flight summary request failed: 400 Validation error"),
    );

    const response = await POST(makeRequest({ flightNumber: "NOTAFLIGHT" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toMatch(/Validation error/);
  });

  it("returns 500 when the FR24 API token is not configured", async () => {
    checkFlightCallableMock.mockRejectedValue(
      new Error("FR24 API token is not configured"),
    );

    const response = await POST(makeRequest({ flightNumber: "BA285" }));

    expect(response.status).toBe(500);
  });

  it("returns 500 when FR24 rejects the request as unauthorized", async () => {
    checkFlightCallableMock.mockRejectedValue(
      new Fr24RequestError(401, "FR24 flight summary request failed: 401 Unauthorized"),
    );

    const response = await POST(makeRequest({ flightNumber: "BA285" }));

    expect(response.status).toBe(500);
  });

  it("returns 502 for other upstream FR24 errors", async () => {
    checkFlightCallableMock.mockRejectedValue(
      new Fr24RequestError(402, "FR24 flight summary request failed: 402 Payment Required"),
    );

    const response = await POST(makeRequest({ flightNumber: "BA285" }));
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json.error).toMatch(/Payment Required/);
  });
});
