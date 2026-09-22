"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { TrackPoint } from "@/app/actions/flightTrack";
import type { LatLon } from "@/lib/flightTracking/geo";
import type { PlanePosition } from "@/lib/flightTracking/routeRendering";
import { applyMarkerRotation } from "./planeMarker";
import { createPlaneAnimationLoop } from "./planeAnimationLoop";
import { drawRoute } from "./drawRoute";
import type { Correction, ExtrapolationBasis, GlobeMapRefs } from "./types";

interface GlobeMapProps {
  accessToken: string;
  track: TrackPoint[] | null;
  tailMode: boolean;
  onTailModeInterrupted: () => void;
}

export default function GlobeMap({
  accessToken,
  track,
  tailMode,
  onTailModeInterrupted,
}: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
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
  // Read fresh inside the map event handlers below, which are only bound once.
  const onTailModeInterruptedRef = useRef(onTailModeInterrupted);
  const ensureAnimationLoopRunningRef = useRef<(() => void) | null>(null);

  // The imperative map/animation state, bundled for the extracted
  // planeAnimationLoop and drawRoute modules — see GlobeMapRefs for why
  // these need to be shared rather than owned by a single effect. Built
  // fresh inside each effect below (rather than once here) so its plain
  // object identity doesn't itself need to be tracked as an effect
  // dependency — every field is a ref, already exempt from that.
  function currentRefs(): GlobeMapRefs {
    return {
      mapRef,
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
    if (!containerRef.current) return;

    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      projection: "globe",
      zoom: 2.2,
      center: [0, 20],
    });

    map.on("style.load", () => {
      map.setConfigProperty("basemap", "lightPreset", "night");
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

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

    mapRef.current = map;

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
      map.remove();
      mapRef.current = null;
    };
  }, [accessToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncRoute = () => drawRoute(map, track, tailMode, currentRefs());

    if (map.isStyleLoaded()) {
      syncRoute();
    } else {
      map.once("style.load", syncRoute);
    }
  }, [track, tailMode]);

  return <div ref={containerRef} className="h-full w-full" />;
}
