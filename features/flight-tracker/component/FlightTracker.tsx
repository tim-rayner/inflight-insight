"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import FlightTelemetryPanel from "@/features/flight-telemetry/component/FlightTelemetryPanel";
import { FlightWrapper, PlaneLocationLog } from "@/features/flight-telemetry/component/FlightWrapper";
import {
  getCachedFlightTrack,
  getTrackedFlightNumber,
  setCachedFlightTrack,
  setTrackedFlightNumber,
} from "@/features/flight-tracker/lib/storage";
import { persistTrackedFlightNumber } from "@/features/flight-tracker/lib/persistTrackedFlightNumber";
import { resolveFlightRoute, type ResolveFlightRouteResult } from "@/features/flight-tracker/lib/resolveFlightRoute";

const MapView = dynamic(() => import("@/features/map/component/MapView"), { ssr: false });
const FlightRouteLayer = dynamic(() => import("@/features/flight-route/component/FlightRouteLayer"), { ssr: false });

interface FlightTrackerProps {
  accessToken: string;
  initialFlightNumber?: string;
}

// Keep the in-view flight status current without hammering the FR24 API.
const POLL_INTERVAL_MS = 61_000;

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getClientSnapshot() {
  return getTrackedFlightNumber() ?? "";
}

function getServerSnapshot() {
  return "";
}

// Seeds TanStack Query with the last-known track for this flight number so a page
// refresh renders the cached route immediately, ahead of any network call.
function initialFallbackResult(flightNumber: string): ResolveFlightRouteResult | undefined {
  if (typeof window === "undefined" || !flightNumber) return undefined;
  const cached = getCachedFlightTrack(flightNumber);
  return cached ? { status: "found", track: cached.track, record: cached.record } : undefined;
}

export default function FlightTracker({ accessToken, initialFlightNumber = "" }: FlightTrackerProps) {
  const persistedFlightNumber = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const [draftInput, setDraftInput] = useState<string | null>(null);
  const [submittedOverride, setSubmittedOverride] = useState<string | null>(null);
  const submittedFlightNumber = submittedOverride ?? (persistedFlightNumber || initialFlightNumber);
  const flightNumberInput = draftInput ?? (persistedFlightNumber || initialFlightNumber);
  const [tailMode, setTailMode] = useState(false);

  const { data: result, isLoading } = useQuery({
    queryKey: ["flight-route", submittedFlightNumber],
    queryFn: () => resolveFlightRoute(submittedFlightNumber),
    enabled: !!submittedFlightNumber,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
    initialDataUpdatedAt: 0,
    initialData: () => initialFallbackResult(submittedFlightNumber),
  });

  useEffect(() => {
    if (submittedFlightNumber && result?.status === "found") {
      setCachedFlightTrack(submittedFlightNumber, result.track, result.record);
    }
  }, [submittedFlightNumber, result]);

  const track = result?.status === "found" ? result.track : null;
  const record = result?.status === "found" ? result.record : null;
  const statusMessage =
    result?.status === "not-callable"
      ? `No active flight found for ${submittedFlightNumber}`
      : result?.status === "no-track"
        ? `No track data available yet for ${submittedFlightNumber}`
        : result?.status === "error"
          ? result.message
          : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = flightNumberInput.trim();
    if (!trimmed) return;

    setTrackedFlightNumber(trimmed);
    void persistTrackedFlightNumber(trimmed);
    setSubmittedOverride(trimmed);
    setDraftInput(trimmed);
  }

  return (
    <FlightWrapper flightNumber={submittedFlightNumber} track={track} record={record}>
      <div className="relative h-full w-full">
        <MapView accessToken={accessToken}>
          <FlightRouteLayer
            track={track}
            tailMode={tailMode}
            onTailModeInterrupted={() => setTailMode(false)}
          />
        </MapView>
        <form
          onSubmit={handleSubmit}
          className="absolute left-4 top-4 z-10 flex flex-col gap-2 rounded-lg bg-black/70 p-3 text-sm text-white shadow-lg backdrop-blur"
        >
          <label htmlFor="flight-number" className="font-medium">
            Flight number
          </label>
          <div className="flex gap-2">
            <input
              id="flight-number"
              name="flight-number"
              type="text"
              value={flightNumberInput}
              onChange={(event) => setDraftInput(event.target.value.toUpperCase())}
              placeholder="BA285"
              className="w-32 rounded border border-white/30 bg-white/10 px-2 py-1 uppercase outline-none focus:border-white"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="rounded bg-sky-500 px-3 py-1 font-medium disabled:opacity-50"
            >
              {isLoading ? "Tracking…" : "Track"}
            </button>
          </div>
          <label className="flex items-center gap-2 text-white/80">
            <input
              type="checkbox"
              checked={tailMode}
              onChange={(event) => setTailMode(event.target.checked)}
              className="h-3.5 w-3.5 accent-sky-500"
            />
            Tail mode
          </label>
          {statusMessage && <p className="max-w-xs text-red-300">{statusMessage}</p>}
        </form>
        <PlaneLocationLog />
        {track && <FlightTelemetryPanel />}
      </div>
    </FlightWrapper>
  );
}
