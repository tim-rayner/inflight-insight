"use client";

import { createContext, useContext } from "react";
import type mapboxgl from "mapbox-gl";

export const MapContext = createContext<mapboxgl.Map | null>(null);

// The live Mapbox instance owned by <MapView>, or null before it's finished
// initializing. Lets any feature draw onto the shared map without owning its
// lifecycle or being passed it as a prop.
export function useMap(): mapboxgl.Map | null {
  return useContext(MapContext);
}
