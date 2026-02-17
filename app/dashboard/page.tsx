"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

type Mode = "idle" | "recording" | "simulation";

export default function Dashboard() {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const watchRef = useRef<number | null>(null);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentFlightIdRef = useRef<string | null>(null);

  const [mode, setMode] = useState<Mode>("idle");

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

      mapRef.current = L.map("map").setView([28.6139, 77.2090], 13);

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "" }
      ).addTo(mapRef.current);

      markerRef.current = L.marker([28.6139, 77.2090]).addTo(mapRef.current);

      polylineRef.current = L.polyline([], {
        color: "#00ff00",
        weight: 3,
      }).addTo(mapRef.current);

      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 100);
    }

    init();
    return () => endTrip();
  }, []);

  function endTrip() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }

    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }

    currentFlightIdRef.current = null;
    setMode("idle");
  }

  function startRecording() {
    endTrip();

    const flightId = "LIVE-" + Date.now();
    currentFlightIdRef.current = flightId;

    polylineRef.current.setLatLngs([]);
    setMode("recording");

    if (!navigator.geolocation) return;

    watchRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        markerRef.current.setLatLng([lat, lng]);
        polylineRef.current.addLatLng([lat, lng]);
        mapRef.current.panTo([lat, lng]);

        await fetch("/api/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: flightId,
            latitude: lat,
            longitude: lng,
            timestamp: new Date().toISOString(),
            mode: "live",
          }),
        });
      },
      console.error,
      { enableHighAccuracy: true }
    );
  }

  function startSimulation() {
    endTrip();

    const flightId = "SIM-" + Date.now();
    currentFlightIdRef.current = flightId;

    polylineRef.current.setLatLngs([]);
    setMode("simulation");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        let lat = position.coords.latitude;
        let lng = position.coords.longitude;
        let heading = Math.random() * 2 * Math.PI;

        simIntervalRef.current = setInterval(async () => {
          heading += (Math.random() - 0.5) * 0.1;

          const speed = 0.00005 + Math.random() * 0.00005;

          lat += speed * Math.cos(heading);
          lng += speed * Math.sin(heading);

          markerRef.current.setLatLng([lat, lng]);
          polylineRef.current.addLatLng([lat, lng]);
          mapRef.current.panTo([lat, lng]);

          await fetch("/api/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              device_id: flightId,
              latitude: lat,
              longitude: lng,
              timestamp: new Date().toISOString(),
              mode: "simulation",
            }),
          });
        }, 2000);
      },
      console.error,
      { enableHighAccuracy: true }
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-green-400 font-mono">
      <div className="flex justify-between items-center px-6 py-4 border-b border-green-500/30 bg-green-500/5">
        <div className="text-xl tracking-widest">
          🚁 FLIGHT CONTROL CONSOLE
        </div>

        <div className="flex gap-4">
          <button
            onClick={startRecording}
            className="border border-green-400 px-4 py-2 hover:bg-green-500 hover:text-black transition"
          >
            START RECORDING
          </button>

          <button
            onClick={startSimulation}
            className="border border-green-400 px-4 py-2 hover:bg-green-500 hover:text-black transition"
          >
            START SIMULATION
          </button>

          <button
            onClick={endTrip}
            className="border border-red-400 px-4 py-2 hover:bg-red-500 hover:text-black transition"
          >
            END TRIP
          </button>
        </div>

        <div className="text-sm">
          STATUS:{" "}
          <span className="font-bold">
            {mode === "idle"
              ? "IDLE"
              : mode === "recording"
              ? "RECORDING"
              : "SIMULATING"}
          </span>
        </div>
      </div>

      <div className="flex-1">
        <div id="map" className="h-full w-full" />
      </div>
    </div>
  );
}
