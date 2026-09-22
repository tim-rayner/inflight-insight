import mapboxgl from "mapbox-gl";
import type { TrackPoint } from "@/features/flight-track/lib/getFlightTrack";
import { currentTrackPoint } from "@/features/flight-track/lib/currentTrackPoint";
import { initialBearingDegrees } from "@/features/flight-route/lib/geo";
import { estimateCurrentSpeedMetersPerSecond, extrapolatePosition } from "@/features/flight-route/lib/planeAnimation";
import { originGeoJSON, routeLineFeature, type PlanePosition } from "@/features/flight-route/lib/routeRendering";
import { applyMarkerRotation, createPlaneMarkerElement } from "./planeMarker";
import {
  CORRECTION_DURATION_MS,
  ENDPOINTS_LAYER_ID,
  ENDPOINTS_SOURCE_ID,
  ORIGIN_COLOR,
  ROUTE_LINE_COLOR,
  ROUTE_LINE_LAYER_ID,
  ROUTE_SOURCE_ID,
  TAIL_MODE_ZOOM,
} from "./mapStyle";
import type { ExtrapolationBasis, FlightRouteLayerRefs } from "./types";

// Syncs the map's route line, endpoint markers, and plane marker to the
// latest polled track and tail-mode setting. Called once on mount (once the
// map's style has finished loading) and again on every subsequent track or
// tailMode change.
export function drawRoute(map: mapboxgl.Map, track: TrackPoint[] | null, tailMode: boolean, refs: FlightRouteLayerRefs): void {
  if (!track || track.length === 0) {
    if (refs.planeAnimationFrameRef.current !== null) {
      cancelAnimationFrame(refs.planeAnimationFrameRef.current);
      refs.planeAnimationFrameRef.current = null;
    }
    refs.extrapolationBasisRef.current = null;
    refs.correctionRef.current = null;
    refs.settledPointsRef.current = [];
    refs.displayedPlanePositionRef.current = null;
    refs.headingSegmentRef.current = null;
    refs.planeMarkerRef.current?.remove();
    refs.planeMarkerRef.current = null;
    if (map.getLayer(ROUTE_LINE_LAYER_ID)) map.removeLayer(ROUTE_LINE_LAYER_ID);
    if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
    if (map.getLayer(ENDPOINTS_LAYER_ID)) map.removeLayer(ENDPOINTS_LAYER_ID);
    if (map.getSource(ENDPOINTS_SOURCE_ID)) map.removeSource(ENDPOINTS_SOURCE_ID);
    // Next flight tracked starts a fresh view, free to auto-fit again.
    refs.userInteractedRef.current = false;
    refs.tailModeActiveRef.current = false;
    refs.tailModeEasingRef.current = false;
    return;
  }

  // True only the first time this route is drawn (or redrawn after a
  // reset) — later polling refetches just update the existing sources'
  // data below, so the camera is left alone and never re-fit or panned.
  const isFirstDraw = !map.getSource(ROUTE_SOURCE_ID);

  // Every confirmed point is "settled" — the line's tip beyond it is
  // always the live (dead-reckoned or corrected) marker position, drawn
  // every animation frame by the plane animation loop, never here.
  refs.settledPointsRef.current = track;
  const latest = currentTrackPoint(track);
  if (!latest) return;
  const previous: TrackPoint | undefined = track.length >= 2 ? track[track.length - 2] : undefined;
  const latestPosition: PlanePosition = { lon: latest.lon, lat: latest.lat };
  const latestTimestampMs = new Date(latest.timestamp).getTime();

  // A heading is only derivable with at least two points — with just
  // one, there's nothing to extrapolate along yet, so the marker is
  // placed but stays put until a second point gives it a trajectory.
  const newBasis: ExtrapolationBasis | null = previous
    ? {
        origin: latestPosition,
        originTimestampMs: latestTimestampMs,
        bearingDegrees: initialBearingDegrees(previous, latest),
        speedMetersPerSecond: estimateCurrentSpeedMetersPerSecond(track),
      }
    : null;

  if (!map.getSource(ROUTE_SOURCE_ID)) {
    map.addSource(ROUTE_SOURCE_ID, {
      type: "geojson",
      data: routeLineFeature(track, latestPosition),
    });
    map.addLayer({
      id: ROUTE_LINE_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      // A flat (not round) cap so the rendered line never extends past
      // its own tip vertex — the line must never visibly get ahead of
      // wherever the plane marker actually is.
      layout: { "line-join": "round", "line-cap": "butt", "line-round-limit": 2 },
      paint: { "line-color": ROUTE_LINE_COLOR, "line-width": 4, "line-emissive-strength": 1 },
    });
  }

  const originData = originGeoJSON(track);
  const originSource = map.getSource(ENDPOINTS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;

  if (originSource) {
    originSource.setData(originData);
  } else {
    map.addSource(ENDPOINTS_SOURCE_ID, { type: "geojson", data: originData });
    map.addLayer({
      id: ENDPOINTS_LAYER_ID,
      type: "circle",
      source: ENDPOINTS_SOURCE_ID,
      paint: {
        "circle-radius": 5,
        "circle-color": ORIGIN_COLOR,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
        "circle-emissive-strength": 1,
      },
    });
  }

  const marker = refs.planeMarkerRef.current;

  if (!marker) {
    // Nothing dead-reckoned yet — place the marker straight at the
    // authoritative position; the continuous animation loop takes over
    // from here once `newBasis` gives it a trajectory to extrapolate.
    const newMarker = new mapboxgl.Marker({
      element: createPlaneMarkerElement(),
      rotationAlignment: "map",
    })
      .setLngLat([latestPosition.lon, latestPosition.lat])
      .addTo(map);
    refs.planeMarkerRef.current = newMarker;
    refs.displayedPlanePositionRef.current = latestPosition;
    refs.extrapolationBasisRef.current = newBasis;
    // No prior point yet on the very first placement — nothing to point
    // the nose along, so leave the default rotation until a second point
    // arrives.
    if (previous) {
      refs.headingSegmentRef.current = { from: previous, to: latestPosition };
      applyMarkerRotation(map, newMarker, previous, latestPosition);
    }
  } else if (newBasis) {
    // A poll re-landing the *same* latest checkpoint (FR24 hasn't
    // refreshed yet) changes nothing here — dead reckoning just keeps
    // running off the existing basis, with no visible effect. Only a
    // genuinely new checkpoint gets a brief correction blend, easing
    // from wherever the marker had been dead-reckoned to over to the
    // fresh authoritative spot.
    const previousBasis = refs.extrapolationBasisRef.current;
    const isNewCheckpoint = !previousBasis || previousBasis.originTimestampMs !== newBasis.originTimestampMs;

    if (isNewCheckpoint) {
      const predictedNow = refs.displayedPlanePositionRef.current ?? newBasis.origin;
      // The fresh checkpoint can itself already be a little stale by the
      // time it arrives (network/API latency), so extrapolate it forward
      // too rather than blending toward a position that's already
      // slightly behind reality.
      const authoritativeNow = extrapolatePosition(
        newBasis.origin,
        newBasis.bearingDegrees,
        newBasis.speedMetersPerSecond,
        Date.now() - newBasis.originTimestampMs,
      );
      refs.correctionRef.current = {
        from: predictedNow,
        to: authoritativeNow,
        startTime: performance.now(),
        durationMs: CORRECTION_DURATION_MS,
      };
    }

    refs.extrapolationBasisRef.current = newBasis;
  }

  refs.ensureAnimationLoopRunningRef.current?.();

  if (tailMode) {
    // Following the plane overrides the usual "don't shift the map"
    // rule: zoom in the moment tail mode engages. After that, the
    // animation loop above pans every frame to track the marker.
    const justEngaged = !refs.tailModeActiveRef.current;
    if (justEngaged) {
      refs.tailModeEasingRef.current = true;
      map.easeTo({
        center: [latestPosition.lon, latestPosition.lat],
        zoom: TAIL_MODE_ZOOM,
        duration: 1500,
      });
      map.once("moveend", () => {
        refs.tailModeEasingRef.current = false;
      });
    }
    refs.tailModeActiveRef.current = true;
  } else {
    refs.tailModeActiveRef.current = false;
    if (isFirstDraw && !refs.userInteractedRef.current) {
      const [first, ...rest] = track;
      const bounds = rest.reduce(
        (accumulated, point) => accumulated.extend([point.lon, point.lat]),
        new mapboxgl.LngLatBounds([first.lon, first.lat], [first.lon, first.lat]),
      );
      map.fitBounds(bounds, { padding: 80, duration: 1000 });
    }
  }
}
