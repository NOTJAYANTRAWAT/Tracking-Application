import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

// ==========================================
// POST: Save Location Data (Supports Batching)
// ==========================================
export async function POST(req: Request) {
  try {
    const data = await req.json();
    const client = await clientPromise;
    const db = client.db("helicopterTracker");
    const collection = db.collection("mobileTrips");

    // 🔹 If the app sends a batched array of points
    if (data.points && Array.isArray(data.points)) {
      if (data.points.length > 0) {
        await collection.insertMany(data.points);
        return NextResponse.json({ status: "batch_saved", count: data.points.length });
      }
      return NextResponse.json({ status: "empty_batch" });
    }

    // 🔹 Fallback: If it's a single point (for testing or old app versions)
    if (data.trip_id && data.latitude) {
      await collection.insertOne(data);
      return NextResponse.json({ status: "saved" });
    }

    return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
  } catch (error) {
    console.error("API POST Error:", error);
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
  }
}

// ==========================================
// GET: Fetch Data for Admin Dashboard
// ==========================================
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent_id");
  const tripId = searchParams.get("trip_id");
  const latest = searchParams.get("latest");
  const recent = searchParams.get("recent"); 

  const client = await clientPromise;
  const db = client.db("helicopterTracker");
  const collection = db.collection("mobileTrips");

  // 🛰️ LIVE FLEET LOGIC: Triggered when "Activate Live Fleet" is ON
  if (recent === "true") {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const activeAgents = await collection.aggregate([
      { $match: { timestamp: { $gte: fiveMinutesAgo } } },
      { $sort: { timestamp: -1 } },
      { $group: {
          _id: "$trip_id",
          latitude: { $first: "$latitude" },
          longitude: { $first: "$longitude" },
          agent_id: { $first: "$agent_id" },
          trip_id: { $first: "$trip_id" },
          timestamp: { $first: "$timestamp" }
      }}
    ]).toArray();
    return NextResponse.json(activeAgents);
  }

  // Handle specific trip_id
  if (tripId) {
    const history = await collection.find({ trip_id: tripId }).sort({ timestamp: 1 }).toArray();
    return NextResponse.json(history);
  }

  // Handle specific agent_id
  if (agentId) {
    if (latest === "true") {
      const latestPoint = await collection.find({ agent_id: agentId }).sort({ timestamp: -1 }).limit(1).toArray();
      return NextResponse.json(latestPoint[0] || null);
    }
    const history = await collection.find({ agent_id: agentId }).sort({ timestamp: 1 }).toArray();
    return NextResponse.json(history);
  }

  // Default: Return unique Trip IDs
  const tripIds = await collection.distinct("trip_id");
  return NextResponse.json(tripIds);
}