import { checkFlightCallable } from "@/app/actions/flight";
import { Fr24RequestError } from "@/lib/fr24/errors";

/**
 * POST /api/flight
 * @param request Request object with the flight number in the body.
 * @returns Response object with the flight information or an error message.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const flightNumber =
    typeof body === "object" && body !== null && "flightNumber" in body
      ? (body as { flightNumber: unknown }).flightNumber
      : undefined;

  if (typeof flightNumber !== "string" || flightNumber.trim() === "") {
    return Response.json(
      { error: "flightNumber is required and must be a string" },
      { status: 400 },
    );
  }

  try {
    const result = await checkFlightCallable(flightNumber);
    return Response.json({ data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof Fr24RequestError) {
      if (error.status === 400) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      if (error.status === 401) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ error: error.message }, { status: 502 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("FR24 API token is not configured")) {
      return Response.json({ error: message }, { status: 500 });
    }

    return Response.json({ error: message }, { status: 502 });
  }
}
