"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface Flight {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationSec: number;
  durationLabel: string;
  distance: number;
  status: "ACTIVE" | "COMPLETED";
  latlngs: [number, number][];
  color: string;
}

export default function Admin() {
  const mapRef = useRef<any>(null);
  const polylinesRef = useRef<Record<string, any>>({});
  const heatLayerRef = useRef<any>(null);

  const [flights, setFlights] = useState<Flight[]>([]);
  const [viewMode, setViewMode] = useState<"routes" | "heatmap">("routes");
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const LModule = await import("leaflet");
      const L = LModule.default || LModule;

      (window as any).L = L;
      await import("leaflet.heat");

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      mapRef.current = L.map("adminMap").setView([28.6139, 77.2090], 12);

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "" }
      ).addTo(mapRef.current);

      loadFlights(L);
    }

    init();

    return () => {
      if (mapRef.current) mapRef.current.remove();
    };
  }, []);

  async function loadFlights(L: any) {
    const res = await fetch("/api/location");
    const ids = await res.json();

    const summaries: Flight[] = [];
    const heatPoints: any[] = [];

    for (let id of ids) {
      const resHistory = await fetch(`/api/location?device_id=${id}`);
      const history = await resHistory.json();
      if (!history.length) continue;

      const start = history[0];
      const end = history[history.length - 1];

      const startDate = new Date(start.timestamp);
      const endDate = new Date(end.timestamp);

      const durationSec =
        (endDate.getTime() - startDate.getTime()) / 1000;

      const durationLabel =
        durationSec > 60
          ? `${Math.floor(durationSec / 60)}m ${Math.floor(
              durationSec % 60
            )}s`
          : `${Math.floor(durationSec)}s`;

      const latlngs = history.map((p: any) => {
        heatPoints.push([p.latitude, p.longitude, 0.4]);
        return [p.latitude, p.longitude];
      });

      const color = randomColor();

      const polyline = L.polyline(latlngs, {
        color,
        weight: 3,
      }).addTo(mapRef.current);

      polylinesRef.current[id] = polyline;

      const isActive =
        Date.now() - endDate.getTime() < 15000;

      summaries.push({
        id,
        date: startDate.toLocaleDateString(),
        startTime: startDate.toLocaleTimeString(),
        endTime: endDate.toLocaleTimeString(),
        durationSec,
        durationLabel,
        distance: calculateDistance(history),
        status: isActive ? "ACTIVE" : "COMPLETED",
        latlngs,
        color,
      });
    }

    heatLayerRef.current = (L as any).heatLayer(heatPoints, {
      radius: 25,
      blur: 15,
    });

    setFlights(summaries);
  }

  function toggleView(mode: "routes" | "heatmap") {
    setViewMode(mode);

    if (mode === "heatmap") {
      Object.values(polylinesRef.current).forEach((p: any) =>
        mapRef.current.removeLayer(p)
      );
      heatLayerRef.current.addTo(mapRef.current);
    } else {
      mapRef.current.removeLayer(heatLayerRef.current);
      Object.values(polylinesRef.current).forEach((p: any) =>
        p.addTo(mapRef.current)
      );
    }
  }

  async function replayFlight(id: string) {
    setPlaying(id);

    Object.values(polylinesRef.current).forEach((p: any) =>
      mapRef.current.removeLayer(p)
    );

    const poly = polylinesRef.current[id];
    poly.addTo(mapRef.current);

    const latlngs = flights.find(f => f.id === id)?.latlngs || [];

    for (let i = 0; i < latlngs.length; i++) {
      poly.setLatLngs(latlngs.slice(0, i));
      await new Promise(r => setTimeout(r, 80));
    }

    await new Promise(r => setTimeout(r, 800));

    Object.values(polylinesRef.current).forEach((p: any) =>
      p.addTo(mapRef.current)
    );

    setPlaying(null);
  }

  function focusFlight(id: string) {
    const poly = polylinesRef.current[id];
    mapRef.current.fitBounds(poly.getBounds());
  }

  function randomColor() {
    const colors = ["#00ff00","#00ffff","#ff00ff","#ffff00","#00ff88"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

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

  function haversine(lat1:number,lon1:number,lat2:number,lon2:number){
    const R=6371;
    const dLat=((lat2-lat1)*Math.PI)/180;
    const dLon=((lon2-lon1)*Math.PI)/180;
    const a=Math.sin(dLat/2)**2+
      Math.cos((lat1*Math.PI)/180)*
      Math.cos((lat2*Math.PI)/180)*
      Math.sin(dLon/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  const totalDistance = flights.reduce((a,f)=>a+f.distance,0);
  const avgDuration =
    flights.reduce((a,f)=>a+f.durationSec,0)/(flights.length||1);

  return (
    <div className="h-screen bg-black text-green-400 font-mono flex flex-col overflow-hidden">

      {/* EXECUTIVE STRIP */}
      <div className="flex justify-between px-6 py-4 border-b border-green-500/30 text-sm">
        <div>TOTAL: {flights.length}</div>
        <div>ACTIVE: {flights.filter(f=>f.status==="ACTIVE").length}</div>
        <div>COMPLETED: {flights.filter(f=>f.status==="COMPLETED").length}</div>
        <div>AVG DURATION: {avgDuration.toFixed(1)}s</div>
        <div>TOTAL DIST: {totalDistance.toFixed(2)} km</div>

        <div className="flex gap-4">
          <button onClick={()=>toggleView("routes")} className="border px-3 py-1">
            ROUTES
          </button>
          <button onClick={()=>toggleView("heatmap")} className="border px-3 py-1">
            HEATMAP
          </button>
        </div>
      </div>

       <div className="flex flex-1 overflow-hidden">

        {/* RADAR FLIGHT PANEL */}
        <div className="w-96 p-4 border-r border-green-500/20 overflow-y-auto h-full">
          {flights.map(flight=>(
            <div key={flight.id}
              className="mb-4 p-4 border border-green-500/30 bg-green-500/5 hover:bg-green-500/10 transition">

              <div className="text-xs opacity-70">{flight.id}</div>
              <div className="text-xs opacity-70">{flight.date}</div>
              <div className="text-xs opacity-70">
                {flight.startTime} → {flight.endTime}
              </div>

              <div className="mt-2 text-sm">DURATION: {flight.durationLabel}</div>
              <div className="text-sm">DIST: {flight.distance.toFixed(2)} km</div>

              <div className={`text-sm mt-1 ${
                flight.status==="ACTIVE" ? "animate-pulse" : "opacity-60"
              }`}>
                STATUS: {flight.status}
              </div>

              <div className="flex gap-2 mt-3">
                <button onClick={()=>focusFlight(flight.id)}
                  className="flex-1 border px-2 py-1 text-xs">
                  FOCUS
                </button>
                <button onClick={()=>replayFlight(flight.id)}
                  className="flex-1 border px-2 py-1 text-xs">
                  REPLAY
                </button>
              </div>

              {playing===flight.id && (
                <div className="text-xs mt-2 animate-pulse">REPLAYING...</div>
              )}
            </div>
          ))}
        </div>

        {/* MAP */}
        <div id="adminMap" className="flex-1 h-full" />
      </div>
    </div>
  );
}
