"use client";

import MapView from "@/features/map/component/MapView";
import FlightRouteLayer from "@/features/flight-route/component/FlightRouteLayer";
import type { TrackPoint } from "@/features/flight-track/lib/getFlightTrack";

interface FlightMapProps {
  accessToken: string;
  track: TrackPoint[] | null;
  tailMode: boolean;
  onTailModeInterrupted: () => void;
}

// MapView and FlightRouteLayer must live in the same client chunk. Loading
// them with two `next/dynamic({ ssr: false })` calls can duplicate MapContext
// and mapbox-gl, so the layer never sees the map and neither the plane nor
// the route line draws.
export default function FlightMap({
  accessToken,
  track,
  tailMode,
  onTailModeInterrupted,
}: FlightMapProps) {
  return (
    <MapView accessToken={accessToken}>
      <FlightRouteLayer
        track={track}
        tailMode={tailMode}
        onTailModeInterrupted={onTailModeInterrupted}
      />
    </MapView>
  );
}
