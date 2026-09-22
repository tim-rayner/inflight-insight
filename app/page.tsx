import { cookies } from "next/headers";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import FlightTracker from "@/features/flight-tracker/component/FlightTracker";
import { resolveFlightRoute } from "@/features/flight-tracker/lib/resolveFlightRoute";

export default async function Home() {
  const accessToken = process.env.MAPBOX_TOKEN;

  if (!accessToken) {
    throw new Error("MAPBOX_TOKEN is not configured");
  }

  const cookieStore = await cookies();
  const flightNumber = cookieStore.get("trackedFlightNumber")?.value.trim() ?? "";
  const queryClient = new QueryClient();

  if (flightNumber) {
    await queryClient.prefetchQuery({
      queryKey: ["flight-route", flightNumber],
      queryFn: () => resolveFlightRoute(flightNumber),
      staleTime: 61_000,
    });
  }

  return (
    <div className="fixed inset-0">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <FlightTracker accessToken={accessToken} initialFlightNumber={flightNumber} />
      </HydrationBoundary>
    </div>
  );
}
