"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastToAll = broadcastToAll;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_apigatewaymanagementapi_1 = require("@aws-sdk/client-apigatewaymanagementapi");
const ddb = lib_dynamodb_1.DynamoDBDocumentClient.from(new client_dynamodb_1.DynamoDBClient({}));
const TABLE = process.env.WS_CONNECTIONS_TABLE;
const MANAGEMENT_ENDPOINT = process.env.WS_MANAGEMENT_ENDPOINT;
const mgmt = new client_apigatewaymanagementapi_1.ApiGatewayManagementApiClient({
    endpoint: MANAGEMENT_ENDPOINT,
});
async function broadcastToAll(message) {
    const payload = typeof message === "string" ? message : JSON.stringify(message);
    const scanRes = await ddb.send(new lib_dynamodb_1.ScanCommand({
        TableName: TABLE,
        ProjectionExpression: "connectionId",
    }));
    const items = scanRes.Items || [];
    const promises = items.map(async (item) => {
        const connectionId = item.connectionId;
        try {
            await mgmt.send(new client_apigatewaymanagementapi_1.PostToConnectionCommand({
                ConnectionId: connectionId,
                Data: Buffer.from(payload),
            }));
        }
        catch (err) {
            // If connection is stale, you can delete it here
            if (err.statusCode === 410) {
                console.log("Stale connection, deleting:", connectionId);
                // optional: delete from DDB
            }
            else {
                console.error("Failed to send to", connectionId, err);
            }
        }
    });
    await Promise.all(promises);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3MtYnJvYWRjYXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsid3MtYnJvYWRjYXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBbUJBLHdDQWlDQztBQXBERCw4REFBMEQ7QUFDMUQsd0RBRytCO0FBQy9CLDRGQUdpRDtBQUVqRCxNQUFNLEdBQUcsR0FBRyxxQ0FBc0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxnQ0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFFaEUsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBcUIsQ0FBQztBQUNoRCxNQUFNLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXVCLENBQUM7QUFFaEUsTUFBTSxJQUFJLEdBQUcsSUFBSSw4REFBNkIsQ0FBQztJQUM3QyxRQUFRLEVBQUUsbUJBQW1CO0NBQzlCLENBQUMsQ0FBQztBQUVJLEtBQUssVUFBVSxjQUFjLENBQUMsT0FBWTtJQUMvQyxNQUFNLE9BQU8sR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUVoRixNQUFNLE9BQU8sR0FBRyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQzVCLElBQUksMEJBQVcsQ0FBQztRQUNkLFNBQVMsRUFBRSxLQUFLO1FBQ2hCLG9CQUFvQixFQUFFLGNBQWM7S0FDckMsQ0FBQyxDQUNILENBQUM7SUFFRixNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztJQUVsQyxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtRQUN4QyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsWUFBc0IsQ0FBQztRQUNqRCxJQUFJLENBQUM7WUFDSCxNQUFNLElBQUksQ0FBQyxJQUFJLENBQ2IsSUFBSSx3REFBdUIsQ0FBQztnQkFDMUIsWUFBWSxFQUFFLFlBQVk7Z0JBQzFCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQzthQUMzQixDQUFDLENBQ0gsQ0FBQztRQUNKLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2xCLGlEQUFpRDtZQUNqRCxJQUFJLEdBQUcsQ0FBQyxVQUFVLEtBQUssR0FBRyxFQUFFLENBQUM7Z0JBQzNCLE9BQU8sQ0FBQyxHQUFHLENBQUMsNkJBQTZCLEVBQUUsWUFBWSxDQUFDLENBQUM7Z0JBQ3pELDRCQUE0QjtZQUM5QixDQUFDO2lCQUFNLENBQUM7Z0JBQ04sT0FBTyxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxZQUFZLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDeEQsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUM5QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRHluYW1vREJDbGllbnQgfSBmcm9tIFwiQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiXCI7XHJcbmltcG9ydCB7XHJcbiAgRHluYW1vREJEb2N1bWVudENsaWVudCxcclxuICBTY2FuQ29tbWFuZCxcclxufSBmcm9tIFwiQGF3cy1zZGsvbGliLWR5bmFtb2RiXCI7XHJcbmltcG9ydCB7XHJcbiAgQXBpR2F0ZXdheU1hbmFnZW1lbnRBcGlDbGllbnQsXHJcbiAgUG9zdFRvQ29ubmVjdGlvbkNvbW1hbmQsXHJcbn0gZnJvbSBcIkBhd3Mtc2RrL2NsaWVudC1hcGlnYXRld2F5bWFuYWdlbWVudGFwaVwiO1xyXG5cclxuY29uc3QgZGRiID0gRHluYW1vREJEb2N1bWVudENsaWVudC5mcm9tKG5ldyBEeW5hbW9EQkNsaWVudCh7fSkpO1xyXG5cclxuY29uc3QgVEFCTEUgPSBwcm9jZXNzLmVudi5XU19DT05ORUNUSU9OU19UQUJMRSE7XHJcbmNvbnN0IE1BTkFHRU1FTlRfRU5EUE9JTlQgPSBwcm9jZXNzLmVudi5XU19NQU5BR0VNRU5UX0VORFBPSU5UITtcclxuXHJcbmNvbnN0IG1nbXQgPSBuZXcgQXBpR2F0ZXdheU1hbmFnZW1lbnRBcGlDbGllbnQoe1xyXG4gIGVuZHBvaW50OiBNQU5BR0VNRU5UX0VORFBPSU5ULFxyXG59KTtcclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBicm9hZGNhc3RUb0FsbChtZXNzYWdlOiBhbnkpIHtcclxuICBjb25zdCBwYXlsb2FkID0gdHlwZW9mIG1lc3NhZ2UgPT09IFwic3RyaW5nXCIgPyBtZXNzYWdlIDogSlNPTi5zdHJpbmdpZnkobWVzc2FnZSk7XHJcblxyXG4gIGNvbnN0IHNjYW5SZXMgPSBhd2FpdCBkZGIuc2VuZChcclxuICAgIG5ldyBTY2FuQ29tbWFuZCh7XHJcbiAgICAgIFRhYmxlTmFtZTogVEFCTEUsXHJcbiAgICAgIFByb2plY3Rpb25FeHByZXNzaW9uOiBcImNvbm5lY3Rpb25JZFwiLFxyXG4gICAgfSlcclxuICApO1xyXG5cclxuICBjb25zdCBpdGVtcyA9IHNjYW5SZXMuSXRlbXMgfHwgW107XHJcblxyXG4gIGNvbnN0IHByb21pc2VzID0gaXRlbXMubWFwKGFzeW5jIChpdGVtKSA9PiB7XHJcbiAgICBjb25zdCBjb25uZWN0aW9uSWQgPSBpdGVtLmNvbm5lY3Rpb25JZCBhcyBzdHJpbmc7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBtZ210LnNlbmQoXHJcbiAgICAgICAgbmV3IFBvc3RUb0Nvbm5lY3Rpb25Db21tYW5kKHtcclxuICAgICAgICAgIENvbm5lY3Rpb25JZDogY29ubmVjdGlvbklkLFxyXG4gICAgICAgICAgRGF0YTogQnVmZmVyLmZyb20ocGF5bG9hZCksXHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgIC8vIElmIGNvbm5lY3Rpb24gaXMgc3RhbGUsIHlvdSBjYW4gZGVsZXRlIGl0IGhlcmVcclxuICAgICAgaWYgKGVyci5zdGF0dXNDb2RlID09PSA0MTApIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIlN0YWxlIGNvbm5lY3Rpb24sIGRlbGV0aW5nOlwiLCBjb25uZWN0aW9uSWQpO1xyXG4gICAgICAgIC8vIG9wdGlvbmFsOiBkZWxldGUgZnJvbSBEREJcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKFwiRmFpbGVkIHRvIHNlbmQgdG9cIiwgY29ubmVjdGlvbklkLCBlcnIpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gIGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcclxufVxyXG4iXX0=