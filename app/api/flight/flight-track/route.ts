import { getFlightTrack } from "@/features/flight-track/lib/getFlightTrack";
import { Fr24RequestError } from "@/shared/fr24/errors";

/**
 * POST /api/flight/flight-track
 * @param request Request object with the FR24 ID in the body.
 * @returns
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

  const fr24Id =
    typeof body === "object" && body !== null && "fr24Id" in body
      ? (body as { fr24Id: unknown }).fr24Id
      : undefined;

  if (typeof fr24Id !== "string" || fr24Id.trim() === "") {
    return Response.json(
      { error: "fr24Id is required and must be a string" },
      { status: 400 },
    );
  }

  try {
    const result = await getFlightTrack(fr24Id);
    return Response.json({ data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof Fr24RequestError) {
      if (error.status === 400 || error.status === 404) {
        return Response.json(
          { error: error.message },
          { status: error.status },
        );
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
