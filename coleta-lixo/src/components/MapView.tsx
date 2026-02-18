import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import proj4 from "proj4";
import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";

// Register EPSG:5858 (SIRGAS 2000 / UTM zone 22S)
proj4.defs(
  "EPSG:5858",
  "+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"
);

export interface ColetaInfo {
  bairro: string;
  setor: string;
  frequencia: string;
  turno: string;
  horario: string;
  operacao: string;
}

interface MapViewProps {
  lat: number | null;
  lng: number | null;
  onResult: (results: ColetaInfo[]) => void;
}

function reprojectCoords(coords: number[]): [number, number] {
  const [lng, lat] = proj4("EPSG:5858", "EPSG:4326", [coords[0], coords[1]]);
  return [lng, lat];
}

function reprojectPolygon(coordinates: number[][][][]): number[][][][] {
  return coordinates.map((polygon) =>
    polygon.map((ring) => ring.map((coord) => reprojectCoords(coord)))
  );
}

const MapView = ({ lat, lng, onResult }: MapViewProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const highlightRef = useRef<L.GeoJSON | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);

  // Load and reproject GeoJSON
  useEffect(() => {
    fetch("/data/coleta_seletiva.geojson")
      .then((r) => r.json())
      .then((data) => {
        // Reproject all features
        const reprojected = {
          ...data,
          features: data.features.map((f: any) => ({
            ...f,
            geometry: {
              ...f.geometry,
              coordinates: reprojectPolygon(f.geometry.coordinates),
            },
          })),
        };
        setGeoData(reprojected);
      })
      .catch(console.error);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-25.4284, -49.2733],
      zoom: 12,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add GeoJSON layer
  useEffect(() => {
    if (!mapRef.current || !geoData) return;

    if (geoLayerRef.current) {
      geoLayerRef.current.remove();
    }

    geoLayerRef.current = L.geoJSON(geoData, {
      style: {
        color: "hsl(152, 55%, 32%)",
        weight: 1,
        fillColor: "hsl(152, 55%, 32%)",
        fillOpacity: 0.08,
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties?.BAIRRO) {
          layer.bindTooltip(feature.properties.BAIRRO, {
            sticky: true,
            className: "font-sans text-xs",
          });
        }
      },
    }).addTo(mapRef.current);
  }, [geoData]);

  // Handle search result
  useEffect(() => {
    if (!mapRef.current || !geoData || lat === null || lng === null) return;

    const map = mapRef.current;

    // Remove old marker and highlight
    if (markerRef.current) markerRef.current.remove();
    if (highlightRef.current) highlightRef.current.remove();

    // Custom marker
    const icon = L.divIcon({
      html: `<div style="background: hsl(152, 55%, 32%); width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
      className: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    markerRef.current = L.marker([lat, lng], { icon }).addTo(map);

    // Find containing polygon
    const point = turf.point([lng, lat]);
    const results: ColetaInfo[] = [];

    for (const feature of geoData.features) {
      try {
        const geom = feature.geometry as MultiPolygon | Polygon;
        let isInside = false;

        if (geom.type === "MultiPolygon") {
          for (const poly of geom.coordinates) {
            const polygon = turf.polygon(poly as any);
            if (turf.booleanPointInPolygon(point, polygon)) {
              isInside = true;
              break;
            }
          }
        } else if (geom.type === "Polygon") {
          const polygon = turf.polygon(geom.coordinates as any);
          isInside = turf.booleanPointInPolygon(point, polygon);
        }

        if (isInside) {
          results.push({
            bairro: feature.properties.BAIRRO || "N/A",
            setor: feature.properties.Setor_2018 || "N/A",
            frequencia: feature.properties.FREQUENCIA || "N/A",
            turno: feature.properties.TURNO || "N/A",
            horario: feature.properties.Horario || "N/A",
            operacao: feature.properties["OPERAÇÃO"] || "N/A",
          });

          // Highlight the polygon
          highlightRef.current = L.geoJSON(feature as any, {
            style: {
              color: "hsl(196, 60%, 42%)",
              weight: 3,
              fillColor: "hsl(152, 55%, 32%)",
              fillOpacity: 0.2,
            },
          }).addTo(map);
        }
      } catch {
        // Skip invalid geometries
      }
    }

    map.flyTo([lat, lng], 15, { duration: 1.5 });
    onResult(results);
  }, [lat, lng, geoData]);

  return (
    <div className="container mx-auto px-4 mb-8">
      <div
        ref={containerRef}
        className="w-full h-[250px] sm:h-[320px] rounded-2xl overflow-hidden shadow-medium border border-border"
      />
    </div>
  );
};

export default MapView;
