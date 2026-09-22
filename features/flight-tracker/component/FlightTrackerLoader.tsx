"use client";

import dynamic from "next/dynamic";

const FlightTracker = dynamic(() => import("@/features/flight-tracker/component/FlightTracker"), {
  ssr: false,
});

interface FlightTrackerLoaderProps {
  accessToken: string;
}

export default function FlightTrackerLoader({ accessToken }: FlightTrackerLoaderProps) {
  return <FlightTracker accessToken={accessToken} />;
}
