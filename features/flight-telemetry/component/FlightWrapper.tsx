"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { TrackPoint } from "@/features/flight-track/lib/getFlightTrack";
import type { FlightSummaryRecord } from "@/shared/fr24/callsign";
import {
  deriveFlightTelemetry,
  type FlightTelemetry,
} from "@/features/flight-telemetry/lib/deriveFlightTelemetry";

const FlightContext = createContext<FlightTelemetry | undefined>(undefined);

interface FlightWrapperProps {
  flightNumber: string;
  track: TrackPoint[] | null;
  record: FlightSummaryRecord | null;
  children: ReactNode;
}

// App-wide, read-only publication of the tracked flight's telemetry.
// The Track and summary record remain the source of truth; this wrapper
// derives a poll-stable snapshot so the map animation loop is not torn
// down by a one-second React clock.
export function FlightWrapper({ flightNumber, track, record, children }: FlightWrapperProps) {
  const telemetry = useMemo(
    () => deriveFlightTelemetry({ flightNumber, track, record }),
    [flightNumber, track, record],
  );

  return <FlightContext.Provider value={telemetry}>{children}</FlightContext.Provider>;
}

export function useFlight(): FlightTelemetry | undefined {
  return useContext(FlightContext);
}

export function PlaneLocationLog() {
  const flight = useFlight();
  const lat = flight?.location.lat;
  const lng = flight?.location.lng;

  if (lat != null && lng != null) {
    console.log("plane is", { lat, lng });
  }

  return null;
}
