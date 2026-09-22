import mapboxgl from "mapbox-gl";
import type { LatLon } from "@/lib/flightTracking/geo";
import { PLANE_ICON_COLOR } from "./mapStyle";

const PLANE_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 64 64">
  <path d="M32 2 L38 22 L60 34 L60 40 L38 34 L38 46 L48 54 L48 59 L32 54 L16 59 L16 54 L26 46 L26 34 L4 40 L4 34 L26 22 Z"
        fill="${PLANE_ICON_COLOR}" stroke="#1e293b" stroke-width="2" stroke-linejoin="round" />
</svg>`;

// A DOM-based Marker (rather than a symbol layer) so its position and
// rotation update synchronously with our animation loop, in lockstep with
// the route line — a symbol layer instead goes through Mapbox's async
// tile/placement pipeline and can visibly lag the line at high zoom.
export function createPlaneMarkerElement(): HTMLDivElement {
  const element = document.createElement("div");
  element.style.width = "32px";
  element.style.height = "32px";
  element.innerHTML = PLANE_ICON_SVG;
  return element;
}

// Points the marker along the on-screen direction from `from` to `to`,
// rather than a raw compass bearing. Under the globe projection, meridians
// converge toward the poles the way they would on a real globe, so a
// marker rotated by compass bearing alone visibly cants away from the
// route line the further it is from the equator; projecting both segment
// endpoints to screen pixels and measuring the angle between them matches
// whatever Mapbox actually drew for the line, in any projection.
export function applyMarkerRotation(map: mapboxgl.Map, marker: mapboxgl.Marker, from: LatLon, to: LatLon): void {
  const p1 = map.project([from.lon, from.lat]);
  const p2 = map.project([to.lon, to.lat]);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  if (dx === 0 && dy === 0) return;

  const screenBearing = (Math.atan2(dx, -dy) * 180) / Math.PI;
  marker.setRotation((screenBearing + 360) % 360);
}
