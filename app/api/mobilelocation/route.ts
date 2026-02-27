import clientPromise from "@/lib/mongodb";

export async function POST(req: Request) {
  const data = await req.json();
  const client = await clientPromise;
  const db = client.db("helicopterTracker");

  // Consistent with your MongoDB Data Explorer
  await db.collection("mobileTrips").insertOne(data); 

  return Response.json({ status: "saved" });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent_id");
  const tripId = searchParams.get("trip_id");
  const latest = searchParams.get("latest");
  const recent = searchParams.get("recent"); // 🔹 Critical addition

  const client = await clientPromise;
  const db = client.db("helicopterTracker");
  const collection = db.collection("mobileTrips");

  // 🛰️ LIVE FLEET LOGIC: Triggered when "Activate Live Fleet" is ON
  if (recent === "true") {
    // Fetch locations from the last 5 minutes to identify "Active" agents
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const activeAgents = await collection.aggregate([
      { $match: { timestamp: { $gte: fiveMinutesAgo } } },
      { $sort: { timestamp: -1 } },
      { $group: {
          _id: "$trip_id",
          latitude: { $first: "$latitude" },
          longitude: { $first: "$longitude" },
          agent_id: { $first: "$agent_id" },
          trip_id: { $first: "$trip_id" }
      }}
    ]).toArray();

    return Response.json(activeAgents);
  }

  // Handle trip_id (History)
  if (tripId) {
    const history = await collection.find({ trip_id: tripId }).sort({ timestamp: 1 }).toArray();
    return Response.json(history);
  }

  // Handle agent_id
  if (agentId) {
    if (latest === "true") {
      const latestPoint = await collection.find({ agent_id: agentId }).sort({ timestamp: -1 }).limit(1).toArray();
      return Response.json(latestPoint[0] || null);
    }
    const history = await collection.find({ agent_id: agentId }).sort({ timestamp: 1 }).toArray();
    return Response.json(history);
  }

  // Default: Return unique Trip IDs for the sidebar
  const tripIds = await collection.distinct("trip_id");
  return Response.json(tripIds);
}