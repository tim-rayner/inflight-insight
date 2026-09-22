export const TAIL_MODE_ZOOM = 8;

// How long a freshly-polled checkpoint is blended in from wherever the
// dead-reckoned marker currently sits, rather than snapping straight there —
// short enough to feel like a correction, not a new leg of flight.
export const CORRECTION_DURATION_MS = 1200;

export const ROUTE_SOURCE_ID = "flight-route";
export const ROUTE_LINE_LAYER_ID = "flight-route-line";
export const ENDPOINTS_SOURCE_ID = "flight-route-endpoints";
export const ENDPOINTS_LAYER_ID = "flight-route-endpoints-circles";

// Okabe-Ito colorblind-safe palette, chosen for contrast against the dark
// "night" basemap preset.
export const ROUTE_LINE_COLOR = "#F0E442"; // yellow
export const ORIGIN_COLOR = "#E69F00"; // orange
export const PLANE_ICON_COLOR = "#D55E00"; // vermillion
