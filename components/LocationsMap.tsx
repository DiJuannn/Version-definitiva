"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

export type MapLocation = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  sceneCount: number;
};

const MARKER_ICON = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:26px;height:26px;">
      <div style="position:absolute;inset:0;border-radius:9999px;background:var(--accent);opacity:0.25;"></div>
      <div style="position:absolute;inset:6px;border-radius:9999px;background:var(--accent);border:2px solid var(--bg);"></div>
    </div>
  `,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -13],
});

export function LocationsMap({ locations }: { locations: MapLocation[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([40.4168, -3.7038], 6);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = locations.map((location) => {
      const marker = L.marker([location.latitude, location.longitude], {
        icon: MARKER_ICON,
      }).addTo(map);

      marker.bindPopup(
        `<div style="font-family: var(--font-jetbrains-mono), monospace; min-width:160px;">
          <p style="margin:0 0 4px; font-weight:700; text-transform:uppercase; font-size:13px;">${escapeHtml(location.name)}</p>
          ${location.address ? `<p style="margin:0 0 4px; font-size:11px; opacity:0.7;">${escapeHtml(location.address)}</p>` : ""}
          <p style="margin:0 0 8px; font-size:11px; opacity:0.7;">${location.sceneCount} escena${location.sceneCount === 1 ? "" : "s"}</p>
          <a href="/app/localizaciones/${location.id}" style="font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:var(--accent);">Ver ficha →</a>
        </div>`,
      );

      return marker;
    });

    if (locations.length > 0) {
      const bounds = L.latLngBounds(
        locations.map((l) => [l.latitude, l.longitude] as [number, number]),
      );
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }

    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [locations]);

  return <div ref={containerRef} className="vd-dark-map h-[420px] w-full" />;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
