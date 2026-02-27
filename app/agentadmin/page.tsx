"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface Flight {
  id: string;
  agentId: string;
  date: string;
  timestamp: number;
  status: "ACTIVE" | "COMPLETED";
  color: string;
  latlngs?: [number, number][]; 
}

export default function Admin() {
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const layersRef = useRef<Record<string, any>>({}); 
  const liveMarkersRef = useRef<Record<string, any>>({}); 

  const [flights, setFlights] = useState<Flight[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(false);

  useEffect(() => {
    async function init() {
      const LModule = await import("leaflet");
      const L = LModule.default || LModule;
      LRef.current = L;

      mapRef.current = L.map("adminMap", { zoomControl: false }).setView([19.0176, 72.8561], 13);
      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; CartoDB'
      }).addTo(mapRef.current);

      fetchSummaries();
    }
    init();
  }, []);

  // ============================
  // LIVE FLEET LOGIC
  // ============================
  useEffect(() => {
    let fleetInterval: NodeJS.Timeout;

    if (isLiveMode) {
      fleetInterval = setInterval(updateFleet, 3000);
      updateFleet(); 
    } else {
      // Clear live markers when exiting live mode
      Object.values(liveMarkersRef.current).forEach((marker: any) => mapRef.current.removeLayer(marker));
      liveMarkersRef.current = {};
    }

    return () => clearInterval(fleetInterval);
  }, [isLiveMode]);

  async function updateFleet() {
    if (!LRef.current || !mapRef.current) return;
    const L = LRef.current;

    try {
      const res = await fetch("/api/mobilelocation?recent=true");
      const activeData = await res.json();

      // If no one is live, activeData will be []
      if (!Array.isArray(activeData) || activeData.length === 0) {
        // Clear existing markers if they go offline
        Object.values(liveMarkersRef.current).forEach((m: any) => mapRef.current.removeLayer(m));
        liveMarkersRef.current = {};
        return;
      }

      const activeTripIds = new Set(activeData.map((d: any) => d.trip_id));

      // 1. Remove markers for agents who stopped being live
      Object.keys(liveMarkersRef.current).forEach((id) => {
        if (!activeTripIds.has(id)) {
          mapRef.current.removeLayer(liveMarkersRef.current[id]);
          delete liveMarkersRef.current[id];
        }
      });

      // 2. Update or Create markers
      activeData.forEach((data: any) => {
        if (!data.latitude || !data.longitude) return; // Safety check

        if (liveMarkersRef.current[data.trip_id]) {
          liveMarkersRef.current[data.trip_id].setLatLng([data.latitude, data.longitude]);
        } else {
          const pulsingIcon = L.divIcon({
            className: 'pulsing-marker-wrapper',
            html: `<div class="pulsing-dot"></div>`,
            iconSize: [20, 20],
          });

          liveMarkersRef.current[data.trip_id] = L.marker([data.latitude, data.longitude], { icon: pulsingIcon })
            .bindPopup(`<div style="color:black"><b>Agent: ${data.agent_id}</b><br/>LIVE</div>`)
            .addTo(mapRef.current);
        }
      });
    } catch (e) {
      console.error("Fleet update failed", e);
    }
  }

  // ============================
  // CORE FUNCTIONS
  // ============================
  function getAgentColor(name: string) {
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ec4899"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }
  async function fetchSummaries() {
  try {
      const res = await fetch("/api/mobilelocation");
      const ids = await res.json();
      
      // We need to get the actual agent_id field from the database for each trip
      const summaries = await Promise.all(ids.map(async (id: string) => {
        const resHistory = await fetch(`/api/mobilelocation?trip_id=${id}`);
        const history = await resHistory.json();
        
        // Use the actual 'agent_id' from the DB (e.g., "Jayant")
        const realAgentName = history[0]?.agent_id || "Unknown"; 
        const ts = history[0]?.timestamp ? new Date(history[0].timestamp).getTime() : Date.now();

        return {
          id,
          agentId: realAgentName, 
          date: new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
          timestamp: ts,
          status: "COMPLETED",
          color: getAgentColor(realAgentName),
        };
      }));

      setFlights(summaries.sort((a, b) => b.timestamp - a.timestamp));
      setLoading(false);
    } catch (e) {
      console.error(e);
    }
  }
  
  async function loadPath(id: string) {
    if (layersRef.current[id]) return layersRef.current[id].latlngs;
    const res = await fetch(`/api/mobilelocation?trip_id=${id}`);
    const history = await res.json();
    if (!history.length) return null;
    const L = LRef.current;
    const latlngs: [number, number][] = history.map((p: any) => [p.latitude, p.longitude]);
    const color = getAgentColor(history[0].agent_id || "Agent");
    const poly = L.polyline(latlngs, { color, weight: 3 }).addTo(mapRef.current);
    const marker = L.circleMarker(latlngs[latlngs.length - 1], { radius: 6, fillColor: color, color: "#fff", weight: 2, fillOpacity: 1 }).addTo(mapRef.current);
    layersRef.current[id] = { group: L.featureGroup([poly, marker]), polyline: poly, latlngs };
    return latlngs;
  }

  async function focusFlight(id: string) {
    const latlngs = await loadPath(id);
    if (latlngs) mapRef.current.fitBounds(layersRef.current[id].group.getBounds(), { padding: [50, 50] });
  }

  async function replayFlight(id: string) {
    if (playing) return;
    setPlaying(id);
    const latlngs = await loadPath(id);
    if (!latlngs) return;
    const poly = layersRef.current[id].polyline;
    poly.setLatLngs([]);
    for (let i = 0; i < latlngs.length; i++) {
      poly.addLatLng(latlngs[i]);
      await new Promise(r => setTimeout(r, 100)); 
    }
    setPlaying(null);
  }

  return (
    <div className="h-screen bg-[#0d1117] text-gray-300 font-sans flex flex-col overflow-hidden">
      <div className="flex justify-between px-8 py-5 bg-[#161b22] border-b border-white/5 items-center">
        <h1 className="text-white font-black text-xl uppercase italic">HELI <span className="text-blue-500 text-not-italic">RADAR</span></h1>
        <div className="flex gap-4">
            <button 
              onClick={() => setIsLiveMode(!isLiveMode)}
              className={`px-4 py-2 rounded-md text-[10px] font-black transition-all ${isLiveMode ? 'bg-green-500 text-black shadow-lg shadow-green-500/20' : 'bg-gray-800 text-gray-400'}`}
            >
              {isLiveMode ? 'LIVE TRACKING ACTIVE' : 'ACTIVATE LIVE FLEET'}
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-96 bg-[#0d1117] border-r border-white/5 flex flex-col">
          <div className="p-4"><input type="text" placeholder="Search Agent..." className="w-full bg-[#161b22] border border-white/10 rounded-lg px-4 py-2 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/></div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {flights.filter(f => f.agentId.toLowerCase().includes(searchQuery.toLowerCase())).map((flight) => (
              <div key={flight.id} className="p-5 border-b border-white/5 hover:bg-white/[0.02]">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-white font-bold text-sm uppercase">{flight.agentId}</span>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: flight.color }} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => focusFlight(flight.id)} className="flex-1 bg-white/5 py-2 rounded text-[10px] font-bold">LOCATE</button>
                  <button onClick={() => replayFlight(flight.id)} className="flex-1 border border-blue-500/20 text-blue-500 py-2 rounded text-[10px] font-bold">{playing === flight.id ? "SYNCING..." : "REPLAY"}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div id="adminMap" className="flex-1 h-full bg-[#0d1117]" />
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #30363d; border-radius: 10px; }
        .pulsing-dot { width: 12px; height: 12px; background: #22c55e; border: 2px solid white; border-radius: 50%; position: relative; }
        .pulsing-dot::after { content: ""; position: absolute; width: 100%; height: 100%; top: 0; left: 0; background: #22c55e; border-radius: 50%; animation: pulse-ring 1.5s infinite; }
        @keyframes pulse-ring { 0% { transform: scale(0.33); opacity: 1; } 80%, 100% { transform: scale(3); opacity: 0; } }
      `}</style>
    </div>
  );
}