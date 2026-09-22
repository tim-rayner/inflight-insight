export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceMeters(a: LatLon, b: LatLon): number {
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

// Interpolates longitude the short way around, so a flight crossing the
// antimeridian (e.g. 179deg -> -179deg) continues forward across the
// dateline instead of a plain lerp sweeping the long way around the globe.
export function lerpLongitude(start: number, end: number, t: number): number {
  let delta = end - start;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return start + delta * t;
}

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

// Interpolates around whichever way is shorter, so e.g. 350deg -> 10deg
// sweeps through 360/0 instead of the long way back through 180.
export function lerpAngleDegrees(start: number, end: number, t: number): number {
  const delta = normalizeDegrees(end - start + 180) - 180;
  return normalizeDegrees(start + delta * t);
}

// Initial compass bearing (degrees, 0-360) along the great circle from `from`
// to `to`. Used to establish the heading a dead-reckoning extrapolation
// should keep following between polls.
export function initialBearingDegrees(from: LatLon, to: LatLon): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLon = toRadians(to.lon - from.lon);

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  return normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI);
}

// The point reached by travelling `distanceMeters` from `start` along a
// constant compass `bearingDegrees`, following the great circle (not a flat
// lon/lat lerp) — the standard "destination point given distance and
// bearing" formula. Used to dead-reckon the plane's position forward from
// its last confirmed checkpoint using its last known heading and speed.
export function destinationPoint(start: LatLon, bearingDegrees: number, distanceMeters: number): LatLon {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = toRadians(bearingDegrees);
  const lat1 = toRadians(start.lat);
  const lon1 = toRadians(start.lon);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { lat: (lat2 * 180) / Math.PI, lon: (((lon2 * 180) / Math.PI + 540) % 360) - 180 };
}
