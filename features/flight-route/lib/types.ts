import type { RefObject } from "react";
import type mapboxgl from "mapbox-gl";
import type { TrackPoint } from "@/features/flight-track/lib/getFlightTrack";
import type { LatLon } from "@/features/flight-route/lib/geo";
import type { PlanePosition } from "@/features/flight-route/lib/routeRendering";

// The heading/speed model dead reckoning extrapolates from between polls —
// re-derived from the last two checkpoints on every poll that lands a new
// one.
export interface ExtrapolationBasis {
  origin: PlanePosition;
  originTimestampMs: number;
  bearingDegrees: number;
  speedMetersPerSecond: number;
}

// A brief blend applied right after a poll lands a genuinely new checkpoint,
// easing the marker from wherever it had been dead-reckoned to over to the
// fresh authoritative position instead of snapping.
export interface Correction {
  from: PlanePosition;
  to: PlanePosition;
  startTime: number;
  durationMs: number;
}

// The mutable state shared across the layer's user-interaction/animation
// effect, the plane animation loop, and the route-drawing sync — bundled
// together since mapboxgl's imperative API means all three read and write
// the same underlying refs rather than communicating through React state or
// props. The map instance itself isn't a field here — it's passed to each
// helper directly (via `useMap()` in the component), since these refs
// outlive any single map instance.
export interface FlightRouteLayerRefs {
  // Once the user manually pans/zooms, stop overriding their view on redraws.
  userInteractedRef: RefObject<boolean>;
  // Tracks whether tail mode was already active on the last draw, so we only
  // zoom in the moment it's switched on and just pan on every update after.
  tailModeActiveRef: RefObject<boolean>;
  // True while the engage-tail-mode easeTo is still animating, so the
  // per-frame setCenter in the plane's glide loop doesn't stomp on it —
  // setCenter jumps instantly and would cancel the in-flight ease, turning
  // the intended smooth pan into a snap.
  tailModeEasingRef: RefObject<boolean>;
  // Where the marker (and route tip) is currently rendered, including
  // mid-animation — read back whenever a poll lands, so the correction blend
  // eases from wherever the plane visually is rather than jumping back to
  // the last confirmed position.
  displayedPlanePositionRef: RefObject<PlanePosition | null>;
  planeAnimationFrameRef: RefObject<number | null>;
  planeMarkerRef: RefObject<mapboxgl.Marker | null>;
  // The two geographic points defining the marker's current heading — kept
  // so the map's "move" listener can re-project and correct its on-screen
  // rotation whenever the camera changes, even between animation frames.
  headingSegmentRef: RefObject<{ from: LatLon; to: LatLon } | null>;
  // Re-derived from the last two checkpoints whenever a poll lands a new
  // one, and left untouched otherwise so the continuous animation loop keeps
  // dead-reckoning off the most recent real trajectory.
  extrapolationBasisRef: RefObject<ExtrapolationBasis | null>;
  // Set only when a poll lands a genuinely new checkpoint; cleared once the
  // blend finishes and dead reckoning takes back over.
  correctionRef: RefObject<Correction | null>;
  // The full confirmed track making up the route line's "settled" portion,
  // up to (not including) the live tip — kept in a ref so the animation
  // loop, which outlives any single render, can redraw the line every frame
  // without depending on React state.
  settledPointsRef: RefObject<TrackPoint[]>;
  // Read fresh inside the animation loop, which can outlive a single render.
  tailModeRef: RefObject<boolean>;
  // Set by the map-lifecycle effect once the animation loop exists, and
  // called after every route draw so the loop keeps running.
  ensureAnimationLoopRunningRef: RefObject<(() => void) | null>;
}
