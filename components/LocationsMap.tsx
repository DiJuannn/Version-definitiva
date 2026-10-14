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
  // Número que la lista muestra junto al nombre, para encontrarla en el mapa.
  label?: string;
};

// Chincheta con el número de la lista. La activa (la que se señala en la
// lista) crece y se rellena con el acento.
function markerIcon(label: string | undefined, active: boolean) {
  const size = active ? 34 : 26;
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;transition:transform 150ms ease;">
        <div style="position:absolute;inset:0;border-radius:9999px;background:var(--accent);opacity:${active ? 0.35 : 0.2};"></div>
        <div style="position:absolute;inset:${active ? 4 : 3}px;border-radius:9999px;display:grid;place-items:center;
          background:${active ? "var(--accent)" : "var(--bg-raised)"};border:2px solid var(--accent);
          color:${active ? "var(--bg)" : "var(--fg)"};font:700 ${active ? 13 : 11}px/1 var(--font-jetbrains-mono), monospace;
          box-shadow:0 2px 6px rgba(0,0,0,0.45);">${label ? escapeHtml(label) : ""}</div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// Mapa oscuro (.vd-dark-map: teselas de OpenStreetMap invertidas al negro)
// para que encaje con la mesa y los marcadores sean lo que destaca.
// «isolate» encierra los z-index de Leaflet (400–1000) para que no asomen por
// encima de los diálogos.
const MAP_CLASS =
  "vd-dark-map isolate !font-sans [&_.leaflet-popup-content-wrapper]:!rounded-lg [&_.leaflet-control-zoom]:!border-0 [&_.leaflet-control-zoom]:!shadow-md";

export function LocationsMap({
  locations,
  className,
  activeId,
  onSelect,
}: {
  locations: MapLocation[];
  className?: string;
  activeId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

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
    const registry = markersRef.current;

    const markers = locations.map((location) => {
      const marker = L.marker([location.latitude, location.longitude], {
        icon: markerIcon(location.label, false),
        title: location.name,
        keyboard: true,
      }).addTo(map);

      marker.bindPopup(
        `<div style="min-width:170px;">
          <p style="margin:0 0 2px; font-weight:600; font-size:14px; color:var(--fg);">${escapeHtml(location.name)}</p>
          ${location.address ? `<p style="margin:0 0 2px; font-size:12px; color:var(--muted);">${escapeHtml(location.address)}</p>` : ""}
          <p style="margin:0 0 8px; font-size:12px; color:var(--muted);">${location.sceneCount} escena${location.sceneCount === 1 ? "" : "s"}</p>
          <a href="/app/localizaciones/${location.id}" style="font-family: var(--font-jetbrains-mono), monospace; font-size:11px; text-transform:uppercase; letter-spacing:0.1em; color:var(--accent);">Ver ficha →</a>
        </div>`,
      );
      marker.on("click", () => onSelectRef.current?.(location.id));
      registry.set(location.id, marker);

      return marker;
    });

    if (locations.length > 0) {
      const bounds = L.latLngBounds(
        locations.map((l) => [l.latitude, l.longitude] as [number, number]),
      );
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
    }

    return () => {
      markers.forEach((marker) => marker.remove());
      registry.clear();
    };
  }, [locations]);

  // Resalta la chincheta de la localización señalada en la lista.
  useEffect(() => {
    for (const location of locations) {
      const marker = markersRef.current.get(location.id);
      if (!marker) continue;
      const active = location.id === activeId;
      marker.setIcon(markerIcon(location.label, active));
      marker.setZIndexOffset(active ? 1000 : 0);
    }
  }, [activeId, locations]);

  return <div ref={containerRef} className={`${MAP_CLASS} w-full ${className ?? "h-[360px]"}`} />;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
