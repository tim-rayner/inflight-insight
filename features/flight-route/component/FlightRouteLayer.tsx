"use client";

import { useEffect, useRef } from "react";
import type mapboxgl from "mapbox-gl";
import { useMap } from "@/features/map/lib/mapContext";
import type { TrackPoint } from "@/features/flight-track/lib/getFlightTrack";
import type { LatLon } from "@/features/flight-route/lib/geo";
import type { PlanePosition } from "@/features/flight-route/lib/routeRendering";
import { applyMarkerRotation } from "../lib/planeMarker";
import { createPlaneAnimationLoop } from "../lib/planeAnimationLoop";
import { drawRoute } from "../lib/drawRoute";
import type { Correction, ExtrapolationBasis, FlightRouteLayerRefs } from "../lib/types";

interface FlightRouteLayerProps {
  track: TrackPoint[] | null;
  tailMode: boolean;
  onTailModeInterrupted: () => void;
}

// Draws one flight's route, plane marker, and tail-mode camera behavior onto
// the shared `<MapView>` — a consumer of the map, not an owner of it.
export default function FlightRouteLayer({
  track,
  tailMode,
  onTailModeInterrupted,
}: FlightRouteLayerProps) {
  const map = useMap();
  const userInteractedRef = useRef(false);
  const tailModeActiveRef = useRef(false);
  const tailModeEasingRef = useRef(false);
  const displayedPlanePositionRef = useRef<PlanePosition | null>(null);
  const planeAnimationFrameRef = useRef<number | null>(null);
  const planeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const headingSegmentRef = useRef<{ from: LatLon; to: LatLon } | null>(null);
  const extrapolationBasisRef = useRef<ExtrapolationBasis | null>(null);
  const correctionRef = useRef<Correction | null>(null);
  const settledPointsRef = useRef<TrackPoint[]>([]);
  const tailModeRef = useRef(tailMode);
  // Read fresh inside the map event handlers below, which are only bound once per map instance.
  const onTailModeInterruptedRef = useRef(onTailModeInterrupted);
  const ensureAnimationLoopRunningRef = useRef<(() => void) | null>(null);

  // The imperative animation state, bundled for the extracted
  // planeAnimationLoop and drawRoute modules — see FlightRouteLayerRefs for
  // why these need to be shared rather than owned by a single effect. Built
  // fresh inside each effect below (rather than once here) so its plain
  // object identity doesn't itself need to be tracked as an effect
  // dependency — every field is a ref, already exempt from that.
  function currentRefs(): FlightRouteLayerRefs {
    return {
      userInteractedRef,
      tailModeActiveRef,
      tailModeEasingRef,
      displayedPlanePositionRef,
      planeAnimationFrameRef,
      planeMarkerRef,
      headingSegmentRef,
      extrapolationBasisRef,
      correctionRef,
      settledPointsRef,
      tailModeRef,
      ensureAnimationLoopRunningRef,
    };
  }

  useEffect(() => {
    tailModeRef.current = tailMode;
  }, [tailMode]);

  useEffect(() => {
    onTailModeInterruptedRef.current = onTailModeInterrupted;
  }, [onTailModeInterrupted]);

  useEffect(() => {
    if (!map) return;

    // `originalEvent` is only present for user-initiated drags/zooms, not
    // for programmatic camera moves like `fitBounds`/`easeTo`/`setCenter`.
    // Tail mode yields to the user rather than fighting their input — a
    // manual pan or zoom while it's on just switches it off.
    const handleUserInteraction = () => {
      userInteractedRef.current = true;
      if (tailModeRef.current) onTailModeInterruptedRef.current();
    };
    map.on("dragstart", (event) => {
      if (event.originalEvent) handleUserInteraction();
    });
    map.on("zoomstart", (event) => {
      if ("originalEvent" in event && event.originalEvent)
        handleUserInteraction();
    });

    // Re-projecting on every camera move (pan, zoom, rotate, pitch — user- or
    // programmatic) keeps the marker's rotation correct any time the plane
    // isn't actively gliding (the far more common case, since a glide lasts
    // a few seconds out of every ~minute-long poll interval).
    map.on("move", () => {
      const marker = planeMarkerRef.current;
      const segment = headingSegmentRef.current;
      if (marker && segment)
        applyMarkerRotation(map, marker, segment.from, segment.to);
    });

    const animationLoop = createPlaneAnimationLoop(map, currentRefs());
    ensureAnimationLoopRunningRef.current = animationLoop.ensureRunning;

    return () => {
      ensureAnimationLoopRunningRef.current = null;
      if (planeAnimationFrameRef.current !== null) {
        cancelAnimationFrame(planeAnimationFrameRef.current);
        planeAnimationFrameRef.current = null;
      }
      planeMarkerRef.current?.remove();
      planeMarkerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;

    const syncRoute = () => drawRoute(map, track, tailMode, currentRefs());

    // `map.isStyleLoaded()` (`style.loaded()`) requires every source's tiles
    // to be loaded too, which for this app's zoomed-out globe view can take
    // far longer than the style itself — or, with the Standard style's
    // imports, may never flip true at all. Gate on the one-shot "style.load"
    // *event* instead (fires as soon as the style/sprite are parsed, well
    // before tiles finish) rather than re-checking `isStyleLoaded()` inside
    // the handler, which would silently drop the draw forever.
    if (map.isStyleLoaded()) {
      syncRoute();
    } else {
      map.once("style.load", syncRoute);
    }
    return () => {
      map.off("style.load", syncRoute);
    };
  }, [map, track, tailMode]);

  return null;
}
