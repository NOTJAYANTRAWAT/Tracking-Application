"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface FlightSummary {
  id: string;
  duration: string;
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  distance: string;
  startTime: string;
  endTime: string;
  date: string;
}

export default function History() {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  const [flights, setFlights] = useState<FlightSummary[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    let L: any;

    async function init() {
      L = await import("leaflet");

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      mapRef.current = L.map("map", {
        zoomControl: false,
      }).setView([28.6139, 77.2090], 13);

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: "",
        }
      ).addTo(mapRef.current);

      markerRef.current = L.marker([28.6139, 77.2090]).addTo(mapRef.current);
      polylineRef.current = L.polyline([], {
        color: "#00ff00",
        weight: 3,
      }).addTo(mapRef.current);

      loadFlights();
    }

    async function loadFlights() {
    const res = await fetch("/api/location");
    const deviceIds = await res.json();

    const summaries: FlightSummary[] = [];

    for (let id of deviceIds) {
        const resHistory = await fetch(
        `/api/location?device_id=${id}`
        );
        const history = await resHistory.json();

        if (!history.length) continue;

        const start = history[0];
        const end = history[history.length - 1];

        // ✅ Timestamp logic INSIDE loop
        const startDate = new Date(start.timestamp);
        const endDate = new Date(end.timestamp);

        const date = startDate.toLocaleDateString();
        const startTime = startDate.toLocaleTimeString();
        const endTime = endDate.toLocaleTimeString();

        const durationMs =
        endDate.getTime() - startDate.getTime();

        const durationSec = Math.floor(durationMs / 1000);

        const duration =
        durationSec > 60
            ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
            : `${durationSec}s`;

        const distance = calculateDistance(history);

        summaries.push({
        id,
        duration,
        start: { lat: start.latitude, lng: start.longitude },
        end: { lat: end.latitude, lng: end.longitude },
        distance: `${distance.toFixed(2)} km`,
        startTime,
        endTime,
        date,
        });
    }

    setFlights(summaries);
    }


    init();

    return () => {
      if (mapRef.current) mapRef.current.remove();
    };
  }, []);

  function calculateDistance(history: any[]) {
    let total = 0;

    for (let i = 1; i < history.length; i++) {
      total += haversine(
        history[i - 1].latitude,
        history[i - 1].longitude,
        history[i].latitude,
        history[i].longitude
      );
    }

    return total;
  }

  function haversine(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function replayFlight(id: string) {
    setPlaying(id);
    polylineRef.current.setLatLngs([]);

    const res = await fetch(`/api/location?device_id=${id}`);
    const history = await res.json();

    const bounds = history.map((p: any) => [
      p.latitude,
      p.longitude,
    ]);

    mapRef.current.fitBounds(bounds);

    for (let point of history) {
      const latlng: [number, number] = [
        point.latitude,
        point.longitude,
      ];

      markerRef.current.setLatLng(latlng);
      polylineRef.current.addLatLng(latlng);

      await new Promise((r) => setTimeout(r, 120));
    }

    setPlaying(null);
  }

  return (
    <div className="flex h-screen bg-black text-green-400 font-mono">
      {/* Radar Sidebar */}
      <div className="w-96 p-6 overflow-y-auto border-r border-green-500/20">
        <h2 className="text-2xl mb-6 tracking-widest">
          ✈ FLIGHT LOG
        </h2>

        {flights.map((flight) => (
          <div
            key={flight.id}
            className="mb-6 p-4 border border-green-500/30
                       bg-green-500/5
                       hover:bg-green-500/10
                       transition"
          >
            <div className="text-xs opacity-70 mb-2">
              {flight.id}
            </div>
            <div className="text-sm opacity-70">
            DATE: {flight.date}
            </div>
            <div className="text-sm opacity-70">
            TIME: {flight.startTime} → {flight.endTime}
            </div>

            <div className="text-sm">
            DURATION: {flight.duration}
            </div>

            <div className="text-sm">
            DISTANCE: {flight.distance}
            </div>

            <div className="text-sm">
            START: {flight.start.lat.toFixed(3)}, {flight.start.lng.toFixed(3)}
            </div>

            <div className="text-sm">
            END: {flight.end.lat.toFixed(3)}, {flight.end.lng.toFixed(3)}
            </div>

            <div className="text-sm">
              DURATION: {flight.duration}
            </div>
            <div className="text-sm">
              DISTANCE: {flight.distance}
            </div>
            <div className="text-sm">
              START: {flight.start.lat.toFixed(3)}, {flight.start.lng.toFixed(3)}
            </div>
            <div className="text-sm">
              END: {flight.end.lat.toFixed(3)}, {flight.end.lng.toFixed(3)}
            </div>

            <button
              onClick={() => replayFlight(flight.id)}
              className="mt-4 w-full border border-green-400
                         hover:bg-green-500 hover:text-black
                         py-2 transition"
            >
              ▶ REPLAY
            </button>

            {playing === flight.id && (
              <div className="mt-2 text-xs animate-pulse">
                REPLAYING...
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Map */}
      <div id="map" className="flex-1" />
    </div>
  );
}
