"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapContext } from "../lib/mapContext";

interface MapViewProps {
  accessToken: string;
  children?: ReactNode;
}

// The application's shared map surface — a dark, globe-projected Mapbox
// instance that any feature can draw onto via `useMap()`. Owns only the
// map's own lifecycle and chrome (projection, night styling, zoom/pan
// controls); knows nothing about what gets drawn on it.
function MapView({ accessToken, children }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = accessToken;

    const instance = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      projection: "globe",
      zoom: 2.2,
      center: [0, 20],
    });

    instance.once("style.load", () => {
      instance.setConfigProperty("basemap", "lightPreset", "night");
    });

    instance.addControl(new mapboxgl.NavigationControl(), "top-right");

    setMap(instance);

    return () => {
      instance.remove();
      setMap(null);
    };
  }, [accessToken]);

  return (
    <MapContext.Provider value={map}>
      <div ref={containerRef} className="h-full w-full" />
      {map && children}
    </MapContext.Provider>
  );
}

export default MapView;
