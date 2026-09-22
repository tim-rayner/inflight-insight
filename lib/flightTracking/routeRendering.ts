import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { TrackPoint } from "@/app/actions/flightTrack";
import { destinationPoint, type LatLon } from "@/lib/flightTracking/geo";

// A short fixed distance used only to build a second point near the plane's
// current position for computing its on-screen rotation — see
// `headingReferencePoint` below.
const ROTATION_LOOKBACK_METERS = 200;

export interface PlanePosition {
  lon: number;
  lat: number;
}

export function originGeoJSON(track: TrackPoint[]): FeatureCollection<Point> {
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

// The route line's tip always matches wherever the plane marker currently
// is — including mid-glide — so the two never visibly disagree about the
// plane's position.
export function routeLineFeature(
  settledPoints: TrackPoint[],
  tip: PlanePosition,
): Feature<LineString> {
  const coordinates: [number, number][] = settledPoints.map((point) => [
    point.lon,
    point.lat,
  ]);
  coordinates.push([tip.lon, tip.lat]);

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates },
  };
}

// A point is a short, fixed distance behind the plane's current position along
// its current heading — paired with the position itself, this gives
// applyMarkerRotation two points close together regardless of how far the
// plane has actually dead-reckoned from its last confirmed checkpoint, so
// its on-screen bearing stays accurate (a long-range "from" far behind can
// disagree with the local screen direction once the camera is zoomed in).
export function headingReferencePoint(
  position: LatLon,
  bearingDegrees: number,
): LatLon {
  return destinationPoint(
    position,
    (bearingDegrees + 180) % 360,
    ROTATION_LOOKBACK_METERS,
  );
}
