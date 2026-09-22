"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { TrackPoint } from "@/app/actions/flightTrack";
import { destinationPoint, initialBearingDegrees, lerp, lerpLongitude, type LatLon } from "@/lib/flightTracking/geo";
import { estimateCurrentSpeedMetersPerSecond, extrapolatePosition } from "@/lib/flightTracking/planeAnimation";

interface GlobeMapProps {
  accessToken: string;
  track: TrackPoint[] | null;
  tailMode: boolean;
  // Called when the user manually pans/zooms while tail mode is on — tail
  // mode yields to the user rather than fighting their input, so the parent
  // should just flip its checkbox off.
  onTailModeInterrupted: () => void;
}

const TAIL_MODE_ZOOM = 8;

// How long a freshly-polled checkpoint is blended in from wherever the
// dead-reckoned marker currently sits, rather than snapping straight there —
// short enough to feel like a correction, not a new leg of flight.
const CORRECTION_DURATION_MS = 1200;

// A short fixed distance used only to build a second point near the plane's
// current position for computing its on-screen rotation — see
// `headingReferencePoint` below.
const ROTATION_LOOKBACK_METERS = 200;

const ROUTE_SOURCE_ID = "flight-route";
const ROUTE_LINE_LAYER_ID = "flight-route-line";
const ENDPOINTS_SOURCE_ID = "flight-route-endpoints";
const ENDPOINTS_LAYER_ID = "flight-route-endpoints-circles";

// Okabe-Ito colorblind-safe palette, chosen for contrast against the dark
// "night" basemap preset.
const ROUTE_LINE_COLOR = "#F0E442"; // yellow
const ORIGIN_COLOR = "#E69F00"; // orange
const PLANE_ICON_COLOR = "#D55E00"; // vermillion

const PLANE_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 64 64">
  <path d="M32 2 L38 22 L60 34 L60 40 L38 34 L38 46 L48 54 L48 59 L32 54 L16 59 L16 54 L26 46 L26 34 L4 40 L4 34 L26 22 Z"
        fill="${PLANE_ICON_COLOR}" stroke="#1e293b" stroke-width="2" stroke-linejoin="round" />
</svg>`;

// A DOM-based Marker (rather than a symbol layer) so its position and
// rotation update synchronously with our animation loop, in lockstep with
// the route line — a symbol layer instead goes through Mapbox's async
// tile/placement pipeline and can visibly lag the line at high zoom.
function createPlaneMarkerElement(): HTMLDivElement {
  const element = document.createElement("div");
  element.style.width = "32px";
  element.style.height = "32px";
  element.innerHTML = PLANE_ICON_SVG;
  return element;
}

function originGeoJSON(track: TrackPoint[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const origin = track[0];

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { role: "origin" },
        geometry: { type: "Point", coordinates: [origin.lon, origin.lat] },
      },
    ],
  };
}

interface PlanePosition {
  lon: number;
  lat: number;
}

// The heading/speed model dead reckoning extrapolates from between polls —
// re-derived from the last two checkpoints on every poll that lands a new
// one.
interface ExtrapolationBasis {
  origin: PlanePosition;
  originTimestampMs: number;
  bearingDegrees: number;
  speedMetersPerSecond: number;
}

// A brief blend applied right after a poll lands a genuinely new checkpoint,
// easing the marker from wherever it had been dead-reckoned to over to the
// fresh authoritative position instead of snapping.
interface Correction {
  from: PlanePosition;
  to: PlanePosition;
  startTime: number;
  durationMs: number;
}

// Points the marker along the on-screen direction from `from` to `to`,
// rather than a raw compass bearing. Under the globe projection, meridians
// converge toward the poles the way they would on a real globe, so a
// marker rotated by compass bearing alone visibly cants away from the
// route line the further it is from the equator; projecting both segment
// endpoints to screen pixels and measuring the angle between them matches
// whatever Mapbox actually drew for the line, in any projection.
function applyMarkerRotation(map: mapboxgl.Map, marker: mapboxgl.Marker, from: LatLon, to: LatLon): void {
  const p1 = map.project([from.lon, from.lat]);
  const p2 = map.project([to.lon, to.lat]);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  if (dx === 0 && dy === 0) return;

  const screenBearing = (Math.atan2(dx, -dy) * 180) / Math.PI;
  marker.setRotation((screenBearing + 360) % 360);
}

// A point a short, fixed distance behind the plane's current position along
// its current heading — paired with the position itself, this gives
// applyMarkerRotation two points close together regardless of how far the
// plane has actually dead-reckoned from its last confirmed checkpoint, so
// its on-screen bearing stays accurate (a long-range "from" far behind can
// disagree with the local screen direction once the camera is zoomed in).
function headingReferencePoint(position: LatLon, bearingDegrees: number): LatLon {
  return destinationPoint(position, (bearingDegrees + 180) % 360, ROTATION_LOOKBACK_METERS);
}

// The route line's tip always matches wherever the plane marker currently
// is — including mid-glide — so the two never visibly disagree about the
// plane's position.
function routeLineFeature(settledPoints: TrackPoint[], tip: PlanePosition): GeoJSON.Feature<GeoJSON.LineString> {
  const coordinates: [number, number][] = settledPoints.map((point) => [point.lon, point.lat]);
  coordinates.push([tip.lon, tip.lat]);

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates },
  };
}

export default function GlobeMap({ accessToken, track, tailMode, onTailModeInterrupted }: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  // Once the user manually pans/zooms, stop overriding their view on redraws.
  const userInteractedRef = useRef(false);
  // Tracks whether tail mode was already active on the last draw, so we only
  // zoom in the moment it's switched on and just pan on every update after.
  const tailModeActiveRef = useRef(false);
  // True while the engage-tail-mode easeTo below is still animating, so the
  // per-frame setCenter in the plane's glide loop doesn't stomp on it —
  // setCenter jumps instantly and would cancel the in-flight ease, turning
  // the intended smooth pan into a snap.
  const tailModeEasingRef = useRef(false);
  // Where the marker (and route tip) is currently rendered, including
  // mid-animation — read back whenever a poll lands, so the correction blend
  // eases from wherever the plane visually is rather than jumping back to
  // the last confirmed position.
  const displayedPlanePositionRef = useRef<PlanePosition | null>(null);
  const planeAnimationFrameRef = useRef<number | null>(null);
  const planeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  // The two geographic points defining the marker's current heading — kept
  // so the "move" listener below can re-project and correct its on-screen
  // rotation whenever the camera changes, even between animation frames.
  const headingSegmentRef = useRef<{ from: LatLon; to: LatLon } | null>(null);
  // Re-derived from the last two checkpoints whenever a poll lands a new
  // one, and left untouched otherwise so the continuous animation loop below
  // keeps dead-reckoning off the most recent real trajectory.
  const extrapolationBasisRef = useRef<ExtrapolationBasis | null>(null);
  // Set only when a poll lands a genuinely new checkpoint; cleared once the
  // blend finishes and dead reckoning takes back over.
  const correctionRef = useRef<Correction | null>(null);
  // The full confirmed track making up the route line's "settled" portion,
  // up to (not including) the live tip — kept in a ref so the animation
  // loop, which outlives any single render, can redraw the line every frame
  // without depending on React state.
  const settledPointsRef = useRef<TrackPoint[]>([]);
  // Read fresh inside the animation loop, which can outlive a single render.
  const tailModeRef = useRef(tailMode);
  // Read fresh inside the map event handlers below, which are only bound once.
  const onTailModeInterruptedRef = useRef(onTailModeInterrupted);
  // Set by the map-lifecycle effect below, and called by the draw effect —
  // routed through a ref (rather than calling a render-scope function
  // directly) since starting the animation loop reads `performance.now()`/
  // `Date.now()`, which must happen only inside an effect, never render.
  const ensureAnimationLoopRunningRef = useRef<(() => void) | null>(null);

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
      if ("originalEvent" in event && event.originalEvent) handleUserInteraction();
    });

    // Re-projecting on every camera move (pan, zoom, rotate, pitch — user- or
    // programmatic) keeps the marker's rotation correct any time the plane
    // isn't actively gliding (the far more common case, since a glide lasts
    // a few seconds out of every ~minute-long poll interval).
    map.on("move", () => {
      const marker = planeMarkerRef.current;
      const segment = headingSegmentRef.current;
      if (marker && segment) applyMarkerRotation(map, marker, segment.from, segment.to);
    });

    mapRef.current = map;

    // Runs for as long as a flight is tracked, driving the marker every
    // frame: either a brief correction blend right after a poll lands a new
    // checkpoint, or — the common case, for most of every ~minute between
    // polls — dead reckoning forward from the last checkpoint's own heading
    // and speed. This is what keeps the plane moving between polls instead
    // of sitting frozen at the last confirmed point until the next one
    // lands.
    const runAnimationStep = () => {
      const marker = planeMarkerRef.current;
      const basis = extrapolationBasisRef.current;
      if (!marker || !basis) {
        planeAnimationFrameRef.current = null;
        return;
      }

      const correction = correctionRef.current;
      let position: PlanePosition;

      if (correction) {
        const t = Math.min((performance.now() - correction.startTime) / correction.durationMs, 1);
        position = {
          lon: lerpLongitude(correction.from.lon, correction.to.lon, t),
          lat: lerp(correction.from.lat, correction.to.lat, t),
        };
        if (t >= 1) correctionRef.current = null;
      } else {
        position = extrapolatePosition(
          basis.origin,
          basis.bearingDegrees,
          basis.speedMetersPerSecond,
          Date.now() - basis.originTimestampMs,
        );
      }

      displayedPlanePositionRef.current = position;
      // The marker moves via a synchronous DOM update, never lagging a frame
      // behind; the line source below still goes through Mapbox's async
      // GeoJSON pipeline, so if anything briefly disagrees it's the line
      // trailing the plane, not the other way round — and its flat (not
      // round) end cap keeps it from ever visually overshooting its own tip.
      marker.setLngLat([position.lon, position.lat]);
      const routeSource = map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      routeSource?.setData(routeLineFeature(settledPointsRef.current, position));

      if (tailModeRef.current && !tailModeEasingRef.current) {
        map.setCenter([position.lon, position.lat]);
      }

      const headingFrom = headingReferencePoint(position, basis.bearingDegrees);
      headingSegmentRef.current = { from: headingFrom, to: position };
      applyMarkerRotation(map, marker, headingFrom, position);

      planeAnimationFrameRef.current = requestAnimationFrame(runAnimationStep);
    };

    ensureAnimationLoopRunningRef.current = () => {
      if (planeAnimationFrameRef.current === null) {
        planeAnimationFrameRef.current = requestAnimationFrame(runAnimationStep);
      }
    };

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

    const drawRoute = () => {
      if (!track || track.length === 0) {
        if (planeAnimationFrameRef.current !== null) {
          cancelAnimationFrame(planeAnimationFrameRef.current);
          planeAnimationFrameRef.current = null;
        }
        extrapolationBasisRef.current = null;
        correctionRef.current = null;
        settledPointsRef.current = [];
        displayedPlanePositionRef.current = null;
        headingSegmentRef.current = null;
        planeMarkerRef.current?.remove();
        planeMarkerRef.current = null;
        if (map.getLayer(ROUTE_LINE_LAYER_ID)) map.removeLayer(ROUTE_LINE_LAYER_ID);
        if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
        if (map.getLayer(ENDPOINTS_LAYER_ID)) map.removeLayer(ENDPOINTS_LAYER_ID);
        if (map.getSource(ENDPOINTS_SOURCE_ID)) map.removeSource(ENDPOINTS_SOURCE_ID);
        // Next flight tracked starts a fresh view, free to auto-fit again.
        userInteractedRef.current = false;
        tailModeActiveRef.current = false;
        tailModeEasingRef.current = false;
        return;
      }

      // True only the first time this route is drawn (or redrawn after a
      // reset) — later polling refetches just update the existing sources'
      // data below, so the camera is left alone and never re-fit or panned.
      const isFirstDraw = !map.getSource(ROUTE_SOURCE_ID);

      // Every confirmed point is "settled" — the line's tip beyond it is
      // always the live (dead-reckoned or corrected) marker position, drawn
      // every animation frame by runAnimationStep, never here.
      settledPointsRef.current = track;
      const latest = track[track.length - 1];
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

      const marker = planeMarkerRef.current;

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
        planeMarkerRef.current = newMarker;
        displayedPlanePositionRef.current = latestPosition;
        extrapolationBasisRef.current = newBasis;
        // No prior point yet on the very first placement — nothing to point
        // the nose along, so leave the default rotation until a second point
        // arrives.
        if (previous) {
          headingSegmentRef.current = { from: previous, to: latestPosition };
          applyMarkerRotation(map, newMarker, previous, latestPosition);
        }
      } else if (newBasis) {
        // A poll re-landing the *same* latest checkpoint (FR24 hasn't
        // refreshed yet) changes nothing here — dead reckoning just keeps
        // running off the existing basis, with no visible effect. Only a
        // genuinely new checkpoint gets a brief correction blend, easing
        // from wherever the marker had been dead-reckoned to over to the
        // fresh authoritative spot.
        const previousBasis = extrapolationBasisRef.current;
        const isNewCheckpoint = !previousBasis || previousBasis.originTimestampMs !== newBasis.originTimestampMs;

        if (isNewCheckpoint) {
          const predictedNow = displayedPlanePositionRef.current ?? newBasis.origin;
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
          correctionRef.current = {
            from: predictedNow,
            to: authoritativeNow,
            startTime: performance.now(),
            durationMs: CORRECTION_DURATION_MS,
          };
        }

        extrapolationBasisRef.current = newBasis;
      }

      ensureAnimationLoopRunningRef.current?.();

      if (tailMode) {
        // Following the plane overrides the usual "don't shift the map"
        // rule: zoom in the moment tail mode engages. After that, the
        // animation loop above pans every frame to track the marker.
        const justEngaged = !tailModeActiveRef.current;
        if (justEngaged) {
          tailModeEasingRef.current = true;
          map.easeTo({
            center: [latestPosition.lon, latestPosition.lat],
            zoom: TAIL_MODE_ZOOM,
            duration: 1500,
          });
          map.once("moveend", () => {
            tailModeEasingRef.current = false;
          });
        }
        tailModeActiveRef.current = true;
      } else {
        tailModeActiveRef.current = false;
        if (isFirstDraw && !userInteractedRef.current) {
          const [first, ...rest] = track;
          const bounds = rest.reduce(
            (accumulated, point) => accumulated.extend([point.lon, point.lat]),
            new mapboxgl.LngLatBounds([first.lon, first.lat], [first.lon, first.lat]),
          );
          map.fitBounds(bounds, { padding: 80, duration: 1000 });
        }
      }
    };

    if (map.isStyleLoaded()) {
      drawRoute();
    } else {
      map.once("style.load", drawRoute);
    }
  }, [track, tailMode]);

  return <div ref={containerRef} className="h-full w-full" />;
}
