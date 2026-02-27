import clientPromise from "@/lib/mongodb";

export async function POST(req: Request) {
  const data = await req.json();

  const client = await clientPromise;
  const db = client.db("helicopterTracker");

  const result = await db.collection("flights").insertOne(data);

  console.log("Inserted:", result.insertedId);

  return Response.json({ status: "saved" });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("device_id");
  const latest = searchParams.get("latest");

  const client = await clientPromise;
  const db = client.db("helicopterTracker");

  // If no deviceId → return all device IDs
  if (!deviceId) {
    const deviceIds = await db
      .collection("flights")
      .distinct("device_id");

    return Response.json(deviceIds);
  }

  // Latest point
  if (latest === "true") {
    const latestPoint = await db
      .collection("flights")
      .find({ device_id: deviceId })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();

    return Response.json(latestPoint[0] || null);
  }

  // Full history
  const history = await db
    .collection("flights")
    .find({ device_id: deviceId })
    .sort({ timestamp: 1 })
    .toArray();

  return Response.json(history);
}
