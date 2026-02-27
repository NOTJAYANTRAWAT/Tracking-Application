import clientPromise from "@/lib/mongodb";

export async function POST(req: Request) {
  try {
    const { agentId, password } = await req.json();

    if (!agentId || !password) {
      return Response.json({ error: "Missing credentials" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("helicopterTracker");

    // Check if the agent exists in an "agents" collection
    const agent = await db.collection("agents").findOne({ 
      agentId: agentId,
      password: password // Note: In a production app, use bcrypt to compare hashed passwords!
    });

    if (!agent) {
      return Response.json({ error: "Invalid Agent ID or Password" }, { status: 401 });
    }

    // Success! Return the agent details
    return Response.json({ status: "success", agentId: agent.agentId, name: agent.name });

  } catch (error) {
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}