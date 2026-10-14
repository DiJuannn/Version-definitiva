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
      <div style="position:absolute;inset:6px;border-radius:9999px;background:var(--accent);border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.25);"></div>
    </div>
  `,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -13],
});

// Mapa claro, a juego con el área de trabajo: las teselas de OpenStreetMap
// van algo desaturadas para que los marcadores (acento) sean lo que destaca.
// Las clases van con «!» porque leaflet.css no está en ninguna capa y ganaría
// a las utilidades de Tailwind. «isolate» encierra los z-index de Leaflet
// (400–1000) para que no asomen por encima de los diálogos.
const MAP_CLASS =
  "isolate !bg-fg/[0.04] !font-sans [&_.leaflet-tile-pane]:[filter:saturate(0.35)_contrast(0.92)_brightness(1.03)] [&_.leaflet-popup-content-wrapper]:!rounded-lg [&_.leaflet-popup-content-wrapper]:!bg-bg-raised [&_.leaflet-popup-content-wrapper]:!text-fg [&_.leaflet-popup-tip]:!bg-bg-raised [&_.leaflet-control-zoom]:!border-0 [&_.leaflet-control-zoom]:!shadow-md [&_.leaflet-control-zoom_a]:!bg-bg-raised [&_.leaflet-control-zoom_a]:!text-fg [&_.leaflet-control-zoom_a]:!border-line [&_.leaflet-control-attribution]:!bg-bg-raised/80 [&_.leaflet-control-attribution]:!text-muted [&_.leaflet-control-attribution_a]:!text-muted";

export function LocationsMap({ locations, className }: { locations: MapLocation[]; className?: string }) {
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
        `<div style="min-width:170px;">
          <p style="margin:0 0 2px; font-weight:600; font-size:14px; color:var(--fg);">${escapeHtml(location.name)}</p>
          ${location.address ? `<p style="margin:0 0 2px; font-size:12px; color:var(--muted);">${escapeHtml(location.address)}</p>` : ""}
          <p style="margin:0 0 8px; font-size:12px; color:var(--muted);">${location.sceneCount} escena${location.sceneCount === 1 ? "" : "s"}</p>
          <a href="/app/localizaciones/${location.id}" style="font-family: var(--font-jetbrains-mono), monospace; font-size:11px; text-transform:uppercase; letter-spacing:0.1em; color:var(--accent);">Ver ficha →</a>
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

  return <div ref={containerRef} className={`${MAP_CLASS} w-full ${className ?? "h-[360px]"}`} />;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
