"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const ws_broadcast_1 = require("./ws-broadcast");
const client = new client_dynamodb_1.DynamoDBClient({});
const ddb = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const tableName = process.env.TELEMETRY_TABLE;
const handler = async (event) => {
    console.log("Raw event from IoT:", JSON.stringify(event));
    // 1) Required fields
    const device = event.device || event.clientId;
    const sensorId = event.sensor_id;
    const sensorType = event.sensor_type;
    const ts = typeof event.ts === "number"
        ? event.ts
        : Math.floor(Date.now() / 1000);
    if (!device || !sensorId || !sensorType) {
        console.warn("Missing required fields", { device, sensorId, sensorType, event });
        return;
    }
    // 2) Metrics
    let metrics = {};
    // Preferred: device sends a metrics object
    if (event.metrics && typeof event.metrics === "object") {
        for (const [key, value] of Object.entries(event.metrics)) {
            if (typeof value === "number") {
                metrics[key] = value;
            }
        }
    }
    else {
        // Fallback: collect numeric top-level fields
        const reservedKeys = new Set([
            "device",
            "clientId",
            "sensor_id",
            "sensor_type",
            "ts",
            "timestamp",
            "topic",
            "metrics",
            "metric_keys",
            "image_b64", // just in case
        ]);
        for (const [key, value] of Object.entries(event)) {
            if (reservedKeys.has(key))
                continue;
            if (typeof value === "number") {
                metrics[key] = value;
            }
        }
    }
    const metricKeys = event.metric_keys && Array.isArray(event.metric_keys)
        ? event.metric_keys
        : Object.keys(metrics);
    if (metricKeys.length === 0) {
        console.warn("No numeric metrics found in event", { event });
        return;
    }
    // 3) Build final item for DynamoDB
    const item = {
        device,
        ts,
        sensor_id: sensorId,
        sensor_type: sensorType,
        metrics,
        metric_keys: metricKeys,
    };
    // Optional extra fields we want to keep
    const passthroughKeys = ["status", "parking_space", "slot_id", "type"];
    for (const key of passthroughKeys) {
        if (event[key] !== undefined) {
            item[key] = event[key];
        }
    }
    await ddb.send(new lib_dynamodb_1.PutCommand({
        TableName: tableName,
        Item: item,
    }));
    console.log("Wrote item:", item);
    // 4) Broadcast over WebSocket (non-blocking for ingestion)
    const telemetryEvent = {
        type: "telemetry",
        source: "telemetry-ingest",
        ts,
        payload: {
            device,
            sensor_id: sensorId,
            sensor_type: sensorType,
            metrics,
            metric_keys: metricKeys,
            ts,
            // pass through extra context if you want it on the frontend
            status: item.status,
            parking_space: item.parking_space,
            slot_id: item.slot_id,
            type: item.type,
        },
    };
    try {
        await (0, ws_broadcast_1.broadcastToAll)(telemetryEvent);
    }
    catch (err) {
        console.error("Failed to broadcast telemetry over WebSocket:", err);
        // don’t throw — ingestion to DynamoDB already succeeded
    }
    return { status: "ok" };
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVsZW1ldHJ5LWluZ2VzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInRlbGVtZXRyeS1pbmdlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsOERBQTBEO0FBQzFELHdEQUEyRTtBQUMzRSxpREFBZ0Q7QUFFaEQsTUFBTSxNQUFNLEdBQUcsSUFBSSxnQ0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3RDLE1BQU0sR0FBRyxHQUFHLHFDQUFzQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUVoRCxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWdCLENBQUM7QUFFeEMsTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUFFLEtBQVUsRUFBRSxFQUFFO0lBQzFDLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBRTFELHFCQUFxQjtJQUNyQixNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUM7SUFDOUMsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQztJQUNqQyxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDO0lBQ3JDLE1BQU0sRUFBRSxHQUNOLE9BQU8sS0FBSyxDQUFDLEVBQUUsS0FBSyxRQUFRO1FBQzFCLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUNWLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUVwQyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDeEMsT0FBTyxDQUFDLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxD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T0FBTztZQUNQLFdBQVcsRUFBRSxVQUFVO1lBQ3ZCLEVBQUU7WUFDRiw0REFBNEQ7WUFDNUQsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO1lBQ25CLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYTtZQUNqQyxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU87WUFDckIsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1NBQ2hCO0tBQ0YsQ0FBQztJQUVGLElBQUksQ0FBQztRQUNILE1BQU0sSUFBQSw2QkFBYyxFQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQ2IsT0FBTyxDQUFDLEtBQUssQ0FBQywrQ0FBK0MsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNwRSx3REFBd0Q7SUFDMUQsQ0FBQztJQUVELE9BQU8sRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUM7QUFDMUIsQ0FBQyxDQUFDO0FBcEhXLFFBQUEsT0FBTyxXQW9IbEIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEeW5hbW9EQkNsaWVudCB9IGZyb20gXCJAYXdzLXNkay9jbGllbnQtZHluYW1vZGJcIjtcclxuaW1wb3J0IHsgRHluYW1vREJEb2N1bWVudENsaWVudCwgUHV0Q29tbWFuZCB9IGZyb20gXCJAYXdzLXNkay9saWItZHluYW1vZGJcIjtcclxuaW1wb3J0IHsgYnJvYWRjYXN0VG9BbGwgfSBmcm9tIFwiLi93cy1icm9hZGNhc3RcIjsgXHJcblxyXG5jb25zdCBjbGllbnQgPSBuZXcgRHluYW1vREJDbGllbnQoe30pO1xyXG5jb25zdCBkZGIgPSBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LmZyb20oY2xpZW50KTtcclxuXHJcbmNvbnN0IHRhYmxlTmFtZSA9IHByb2Nlc3MuZW52LlRFTEVNRVRSWV9UQUJMRSE7XHJcblxyXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChldmVudDogYW55KSA9PiB7XHJcbiAgY29uc29sZS5sb2coXCJSYXcgZXZlbnQgZnJvbSBJb1Q6XCIsIEpTT04uc3RyaW5naWZ5KGV2ZW50KSk7XHJcblxyXG4gIC8vIDEpIFJlcXVpcmVkIGZpZWxkc1xyXG4gIGNvbnN0IGRldmljZSA9IGV2ZW50LmRldmljZSB8fCBldmVudC5jbGllbnRJZDtcclxuICBjb25zdCBzZW5zb3JJZCA9IGV2ZW50LnNlbnNvcl9pZDtcclxuICBjb25zdCBzZW5zb3JUeXBlID0gZXZlbnQuc2Vuc29yX3R5cGU7XHJcbiAgY29uc3QgdHMgPVxyXG4gICAgdHlwZW9mIGV2ZW50LnRzID09PSBcIm51bWJlclwiXHJcbiAgICAgID8gZXZlbnQudHNcclxuICAgICAgOiBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKTtcclxuXHJcbiAgaWYgKCFkZXZpY2UgfHwgIXNlbnNvcklkIHx8ICFzZW5zb3JUeXBlKSB7XHJcbiAgICBjb25zb2xlLndhcm4oXCJNaXNzaW5nIHJlcXVpcmVkIGZpZWxkc1wiLCB7IGRldmljZSwgc2Vuc29ySWQsIHNlbnNvclR5cGUsIGV2ZW50IH0pO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgLy8gMikgTWV0cmljc1xyXG4gIGxldCBtZXRyaWNzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge307XHJcblxyXG4gIC8vIFByZWZlcnJlZDogZGV2aWNlIHNlbmRzIGEgbWV0cmljcyBvYmplY3RcclxuICBpZiAoZXZlbnQubWV0cmljcyAmJiB0eXBlb2YgZXZlbnQubWV0cmljcyA9PT0gXCJvYmplY3RcIikge1xyXG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoZXZlbnQubWV0cmljcykpIHtcclxuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIikge1xyXG4gICAgICAgIG1ldHJpY3Nba2V5XSA9IHZhbHVlIGFzIG51bWJlcjtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0gZWxzZSB7XHJcbiAgICAvLyBGYWxsYmFjazogY29sbGVjdCBudW1lcmljIHRvcC1sZXZlbCBmaWVsZHNcclxuICAgIGNvbnN0IHJlc2VydmVkS2V5cyA9IG5ldyBTZXQoW1xyXG4gICAgICBcImRldmljZVwiLFxyXG4gICAgICBcImNsaWVudElkXCIsXHJcbiAgICAgIFwic2Vuc29yX2lkXCIsXHJcbiAgICAgIFwic2Vuc29yX3R5cGVcIixcclxuICAgICAgXCJ0c1wiLFxyXG4gICAgICBcInRpbWVzdGFtcFwiLFxyXG4gICAgICBcInRvcGljXCIsXHJcbiAgICAgIFwibWV0cmljc1wiLFxyXG4gICAgICBcIm1ldHJpY19rZXlzXCIsXHJcbiAgICAgIFwiaW1hZ2VfYjY0XCIsIC8vIGp1c3QgaW4gY2FzZVxyXG4gICAgXSk7XHJcblxyXG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoZXZlbnQpKSB7XHJcbiAgICAgIGlmIChyZXNlcnZlZEtleXMuaGFzKGtleSkpIGNvbnRpbnVlO1xyXG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiKSB7XHJcbiAgICAgICAgbWV0cmljc1trZXldID0gdmFsdWUgYXMgbnVtYmVyO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBjb25zdCBtZXRyaWNLZXlzID1cclxuICAgIGV2ZW50Lm1ldHJpY19rZXlzICYmIEFycmF5LmlzQXJyYXkoZXZlbnQubWV0cmljX2tleXMpXHJcbiAgICAgID8gZXZlbnQubWV0cmljX2tleXNcclxuICAgICAgOiBPYmplY3Qua2V5cyhtZXRyaWNzKTtcclxuXHJcbiAgaWYgKG1ldHJpY0tleXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICBjb25zb2xlLndhcm4oXCJObyBudW1lcmljIG1ldHJpY3MgZm91bmQgaW4gZXZlbnRcIiwgeyBldmVudCB9KTtcclxuICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIC8vIDMpIEJ1aWxkIGZpbmFsIGl0ZW0gZm9yIER5bmFtb0RCXHJcbiAgY29uc3QgaXRlbTogYW55ID0ge1xyXG4gICAgZGV2aWNlLFxyXG4gICAgdHMsXHJcbiAgICBzZW5zb3JfaWQ6IHNlbnNvcklkLFxyXG4gICAgc2Vuc29yX3R5cGU6IHNlbnNvclR5cGUsXHJcbiAgICBtZXRyaWNzLFxyXG4gICAgbWV0cmljX2tleXM6IG1ldHJpY0tleXMsXHJcbiAgfTtcclxuXHJcbiAgLy8gT3B0aW9uYWwgZXh0cmEgZmllbGRzIHdlIHdhbnQgdG8ga2VlcFxyXG4gIGNvbnN0IHBhc3N0aHJvdWdoS2V5cyA9IFtcInN0YXR1c1wiLCBcInBhcmtpbmdfc3BhY2VcIiwgXCJzbG90X2lkXCIsIFwidHlwZVwiXTtcclxuXHJcbiAgZm9yIChjb25zdCBrZXkgb2YgcGFzc3Rocm91Z2hLZXlzKSB7XHJcbiAgICBpZiAoZXZlbnRba2V5XSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIGl0ZW1ba2V5XSA9IGV2ZW50W2tleV07XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBhd2FpdCBkZGIuc2VuZChcclxuICAgIG5ldyBQdXRDb21tYW5kKHtcclxuICAgICAgVGFibGVOYW1lOiB0YWJsZU5hbWUsXHJcbiAgICAgIEl0ZW06IGl0ZW0sXHJcbiAgICB9KVxyXG4gICk7XHJcblxyXG4gIGNvbnNvbGUubG9nKFwiV3JvdGUgaXRlbTpcIiwgaXRlbSk7XHJcblxyXG4gIC8vIDQpIEJyb2FkY2FzdCBvdmVyIFdlYlNvY2tldCAobm9uLWJsb2NraW5nIGZvciBpbmdlc3Rpb24pXHJcbiAgY29uc3QgdGVsZW1ldHJ5RXZlbnQgPSB7XHJcbiAgICB0eXBlOiBcInRlbGVtZXRyeVwiLFxyXG4gICAgc291cmNlOiBcInRlbGVtZXRyeS1pbmdlc3RcIixcclxuICAgIHRzLFxyXG4gICAgcGF5bG9hZDoge1xyXG4gICAgICBkZXZpY2UsXHJcbiAgICAgIHNlbnNvcl9pZDogc2Vuc29ySWQsXHJcbiAgICAgIHNlbnNvcl90eXBlOiBzZW5zb3JUeXBlLFxyXG4gICAgICBtZXRyaWNzLFxyXG4gICAgICBtZXRyaWNfa2V5czogbWV0cmljS2V5cyxcclxuICAgICAgdHMsXHJcbiAgICAgIC8vIHBhc3MgdGhyb3VnaCBleHRyYSBjb250ZXh0IGlmIHlvdSB3YW50IGl0IG9uIHRoZSBmcm9udGVuZFxyXG4gICAgICBzdGF0dXM6IGl0ZW0uc3RhdHVzLFxyXG4gICAgICBwYXJraW5nX3NwYWNlOiBpdGVtLnBhcmtpbmdfc3BhY2UsXHJcbiAgICAgIHNsb3RfaWQ6IGl0ZW0uc2xvdF9pZCxcclxuICAgICAgdHlwZTogaXRlbS50eXBlLFxyXG4gICAgfSxcclxuICB9O1xyXG5cclxuICB0cnkge1xyXG4gICAgYXdhaXQgYnJvYWRjYXN0VG9BbGwodGVsZW1ldHJ5RXZlbnQpO1xyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgY29uc29sZS5lcnJvcihcIkZhaWxlZCB0byBicm9hZGNhc3QgdGVsZW1ldHJ5IG92ZXIgV2ViU29ja2V0OlwiLCBlcnIpO1xyXG4gICAgLy8gZG9u4oCZdCB0aHJvdyDigJQgaW5nZXN0aW9uIHRvIER5bmFtb0RCIGFscmVhZHkgc3VjY2VlZGVkXHJcbiAgfVxyXG5cclxuICByZXR1cm4geyBzdGF0dXM6IFwib2tcIiB9O1xyXG59O1xyXG4iXX0=