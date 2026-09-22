import FlightTrackerLoader from "@/app/components/FlightTrackerLoader";

export default function Home() {
  const accessToken = process.env.MAPBOX_TOKEN;

  if (!accessToken) {
    throw new Error("MAPBOX_TOKEN is not configured");
  }

  return (
    <div className="fixed inset-0">
      <FlightTrackerLoader accessToken={accessToken} />
    </div>
  );
}
