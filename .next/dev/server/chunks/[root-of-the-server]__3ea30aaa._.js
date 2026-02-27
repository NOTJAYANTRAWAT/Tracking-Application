module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/lib/mongodb.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$mongodb__$5b$external$5d$__$28$mongodb$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f$mongodb$29$__ = __turbopack_context__.i("[externals]/mongodb [external] (mongodb, cjs, [project]/node_modules/mongodb)");
;
const uri = process.env.MONGODB_URI;
if (!uri) {
    throw new Error("MONGODB_URI is not defined");
}
const options = {};
let client;
let clientPromise;
if ("TURBOPACK compile-time truthy", 1) {
    if (!global._mongoClientPromise) {
        client = new __TURBOPACK__imported__module__$5b$externals$5d2f$mongodb__$5b$external$5d$__$28$mongodb$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f$mongodb$29$__["MongoClient"](uri, options);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
} else //TURBOPACK unreachable
;
const __TURBOPACK__default__export__ = clientPromise;
}),
"[project]/app/api/mobilelocation/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$mongodb$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/mongodb.ts [app-route] (ecmascript)");
;
async function POST(req) {
    const data = await req.json();
    const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$mongodb$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"];
    const db = client.db("helicopterTracker");
    // Consistent with your MongoDB Data Explorer
    await db.collection("mobileTrips").insertOne(data);
    return Response.json({
        status: "saved"
    });
}
async function GET(req) {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agent_id");
    const tripId = searchParams.get("trip_id");
    const latest = searchParams.get("latest");
    const recent = searchParams.get("recent"); // 🔹 Critical addition
    const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$mongodb$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"];
    const db = client.db("helicopterTracker");
    const collection = db.collection("mobileTrips");
    // 🛰️ LIVE FLEET LOGIC: Triggered when "Activate Live Fleet" is ON
    if (recent === "true") {
        // Fetch locations from the last 5 minutes to identify "Active" agents
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const activeAgents = await collection.aggregate([
            {
                $match: {
                    timestamp: {
                        $gte: fiveMinutesAgo
                    }
                }
            },
            {
                $sort: {
                    timestamp: -1
                }
            },
            {
                $group: {
                    _id: "$trip_id",
                    latitude: {
                        $first: "$latitude"
                    },
                    longitude: {
                        $first: "$longitude"
                    },
                    agent_id: {
                        $first: "$agent_id"
                    },
                    trip_id: {
                        $first: "$trip_id"
                    }
                }
            }
        ]).toArray();
        return Response.json(activeAgents);
    }
    // Handle trip_id (History)
    if (tripId) {
        const history = await collection.find({
            trip_id: tripId
        }).sort({
            timestamp: 1
        }).toArray();
        return Response.json(history);
    }
    // Handle agent_id
    if (agentId) {
        if (latest === "true") {
            const latestPoint = await collection.find({
                agent_id: agentId
            }).sort({
                timestamp: -1
            }).limit(1).toArray();
            return Response.json(latestPoint[0] || null);
        }
        const history = await collection.find({
            agent_id: agentId
        }).sort({
            timestamp: 1
        }).toArray();
        return Response.json(history);
    }
    // Default: Return unique Trip IDs for the sidebar
    const tripIds = await collection.distinct("trip_id");
    return Response.json(tripIds);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__3ea30aaa._.js.map