import type mapboxgl from "mapbox-gl";
import { lerp, lerpLongitude } from "@/features/flight-route/lib/geo";
import { extrapolatePosition } from "@/features/flight-route/lib/planeAnimation";
import { headingReferencePoint, routeLineFeature, type PlanePosition } from "@/features/flight-route/lib/routeRendering";
import { applyMarkerRotation } from "./planeMarker";
import { ROUTE_SOURCE_ID } from "./mapStyle";
import type { FlightRouteLayerRefs } from "./types";

// Runs for as long as a flight is tracked, driving the marker every frame:
// either a brief correction blend right after a poll lands a new checkpoint,
// or — the common case, for most of every ~minute between polls — dead
// reckoning forward from the last checkpoint's own heading and speed. This is
// what keeps the plane moving between polls instead of sitting frozen at the
// last confirmed point until the next one lands.
export function createPlaneAnimationLoop(map: mapboxgl.Map, refs: FlightRouteLayerRefs) {
  const runStep = () => {
    const marker = refs.planeMarkerRef.current;
    const basis = refs.extrapolationBasisRef.current;
    if (!marker || !basis) {
      refs.planeAnimationFrameRef.current = null;
      return;
    }

    const correction = refs.correctionRef.current;
    let position: PlanePosition;

    if (correction) {
      const t = Math.min((performance.now() - correction.startTime) / correction.durationMs, 1);
      position = {
        lon: lerpLongitude(correction.from.lon, correction.to.lon, t),
        lat: lerp(correction.from.lat, correction.to.lat, t),
      };
      if (t >= 1) refs.correctionRef.current = null;
    } else {
      position = extrapolatePosition(
        basis.origin,
        basis.bearingDegrees,
        basis.speedMetersPerSecond,
        Date.now() - basis.originTimestampMs,
      );
    }

    refs.displayedPlanePositionRef.current = position;
    // The marker moves via a synchronous DOM update, never lagging a frame
    // behind; the line source below still goes through Mapbox's async
    // GeoJSON pipeline, so if anything briefly disagrees it's the line
    // trailing the plane, not the other way round — and its flat (not
    // round) end cap keeps it from ever visually overshooting its own tip.
    marker.setLngLat([position.lon, position.lat]);
    const routeSource = map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    routeSource?.setData(routeLineFeature(refs.settledPointsRef.current, position));

    if (refs.tailModeRef.current && !refs.tailModeEasingRef.current) {
      map.setCenter([position.lon, position.lat]);
    }

    const headingFrom = headingReferencePoint(position, basis.bearingDegrees);
    refs.headingSegmentRef.current = { from: headingFrom, to: position };
    applyMarkerRotation(map, marker, headingFrom, position);

    refs.planeAnimationFrameRef.current = requestAnimationFrame(runStep);
  };

  return {
    ensureRunning: () => {
      if (refs.planeAnimationFrameRef.current === null) {
        refs.planeAnimationFrameRef.current = requestAnimationFrame(runStep);
      }
    },
  };
}
