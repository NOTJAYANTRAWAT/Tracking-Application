"use client";

import { useState, useEffect, useRef } from "react";

type Mode = "none" | "live" | "simulation";

export default function Tracker() {
  const [mode, setMode] = useState<Mode>("none");

  const watchRef = useRef<number | null>(null);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stop everything
  function stopAll() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }

    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
  }

  // Start Live GPS
  function startLiveTracking() {
  stopAll();

  if (typeof window === "undefined" || !navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  // Set active device for dashboard
  localStorage.setItem("activeDevice", "POC-001");

  watchRef.current = navigator.geolocation.watchPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      console.log("LIVE GPS:", lat, lng);

      await sendToBackend(lat, lng);
    },
    (err) => {
      console.error("GPS ERROR:", err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,      // DO NOT reuse cached position
      timeout: 10000,     // Wait max 10 seconds
    }
  );
}
function startSimulation() {
  stopAll();

  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  // Set a new flight ID
  const flightId = "SIM-" + Date.now();
  localStorage.setItem("activeDevice", flightId);

  // Get LIVE starting location first
  navigator.geolocation.getCurrentPosition(
    (position) => {
      let lat = position.coords.latitude;
      let lng = position.coords.longitude;

      console.log("Simulation starting from:", lat, lng);

      let heading = Math.random() * 2 * Math.PI;

      simIntervalRef.current = setInterval(async () => {

        // Slight smooth turn (natural drift)
        heading += (Math.random() - 0.5) * 0.1;

        // MUCH slower speed (realistic helicopter drift)
        const speed = 0.00005 + Math.random() * 0.00005;

        lat += speed * Math.cos(heading);
        lng += speed * Math.sin(heading);

        await fetch("/api/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: flightId,
            mode: "simulation",
            latitude: lat,
            longitude: lng,
            timestamp: new Date().toISOString(),
          }),
        });

      }, 2000);
    },
    (err) => {
      console.error("GPS error for simulation start:", err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    }
  );
}
  async function sendToBackend(lat: number, lng: number) {
    await fetch("/api/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: "POC-001",
        latitude: lat,
        longitude: lng,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  // React to mode change
  useEffect(() => {
    if (mode === "live") startLiveTracking();
    if (mode === "simulation") startSimulation();
    if (mode === "none") stopAll();

    return () => stopAll();
  }, [mode]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-green-400 gap-6">
      <h1 className="text-2xl font-bold">
        {mode === "none" && "Select Tracking Mode"}
        {mode === "live" && "Live GPS Tracking 🛰"}
        {mode === "simulation" && "Simulation Mode 🚁"}
      </h1>

      <div className="flex gap-4">
        <button
          onClick={() => setMode("live")}
          className="bg-blue-500 text-white px-6 py-2 rounded"
        >
          Live GPS
        </button>

        <button
          onClick={() => setMode("simulation")}
          className="bg-green-500 text-black px-6 py-2 rounded"
        >
          Simulation
        </button>

        <button
          onClick={() => setMode("none")}
          className="bg-red-500 text-white px-6 py-2 rounded"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
