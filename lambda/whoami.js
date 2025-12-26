"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
/**
 * Decode a JWT without verification (for demo only).
 * In production: verify signature with jwks.
 */
function decodeJwt(token) {
    try {
        const parts = token.split(".");
        if (parts.length !== 3)
            return null;
        const payload = Buffer.from(parts[1], "base64").toString("utf8");
        return JSON.parse(payload);
    }
    catch (err) {
        return null;
    }
}
const handler = async (event) => {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    // No token - unauthenticated
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "hi ur not authenticated",
            }),
        };
    }
    const token = authHeader.substring("Bearer ".length);
    const payload = decodeJwt(token);
    if (!payload) {
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "hi ur not authenticated (invalid token)",
            }),
        };
    }
    // Cognito groups come from the ID token claim: cognito:groups
    const rawGroups = payload["cognito:groups"];
    const groups = Array.isArray(rawGroups)
        ? rawGroups
        : typeof rawGroups === "string"
            ? rawGroups.split(",")
            : [];
    // Build message depending on role
    let message = "hi ur authenticated but have no role";
    if (groups.includes("admin"))
        message = "hi ur admin";
    else if (groups.includes("newhire"))
        message = "hi ur newhire";
    else if (groups.includes("visitor"))
        message = "hi ur visitor";
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message,
            groups,
        }),
    };
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2hvYW1pLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsid2hvYW1pLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUVBOzs7R0FHRztBQUNILFNBQVMsU0FBUyxDQUFDLEtBQWE7SUFDOUIsSUFBSSxDQUFDO1FBQ0gsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMvQixJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBRXBDLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNqRSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDN0IsQ0FBQztJQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFDYixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7QUFDSCxDQUFDO0FBRU0sTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUMxQixLQUEyQixFQUNLLEVBQUU7SUFDbEMsTUFBTSxVQUFVLEdBQ2QsS0FBSyxDQUFDLE9BQU8sRUFBRSxhQUFhLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUM7SUFFL0QsNkJBQTZCO0lBQzdCLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7UUFDckQsT0FBTztZQUNMLFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFLEVBQUUsY0FBYyxFQUFFLGtCQUFrQixFQUFFO1lBQy9DLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUNuQixPQUFPLEVBQUUseUJBQXlCO2FBQ25DLENBQUM7U0FDSCxDQUFDO0lBQ0osQ0FBQztJQUVELE1BQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3JELE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUVqQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDYixPQUFPO1lBQ0wsVUFBVSxFQUFFLEdBQUc7WUFDZixPQUFPLEVBQUUsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUU7WUFDL0MsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ25CLE9BQU8sRUFBRSx5Q0FBeUM7YUFDbkQsQ0FBQztTQUNILENBQUM7SUFDSixDQUFDO0lBRUQsOERBQThEO0lBQzlELE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQzVDLE1BQU0sTUFBTSxHQUFhLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDO1FBQy9DLENBQUMsQ0FBQyxTQUFTO1FBQ1gsQ0FBQyxDQUFDLE9BQU8sU0FBUyxLQUFLLFFBQVE7WUFDL0IsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDO1lBQ3RCLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFFUCxrQ0FBa0M7SUFDbEMsSUFBSSxPQUFPLEdBQUcsc0NBQXNDLENBQUM7SUFFckQsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQztRQUFFLE9BQU8sR0FBRyxhQUFhLENBQUM7U0FDakQsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQztRQUFFLE9BQU8sR0FBRyxlQUFlLENBQUM7U0FDMUQsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQztRQUFFLE9BQU8sR0FBRyxlQUFlLENBQUM7SUFFL0QsT0FBTztRQUNMLFVBQVUsRUFBRSxHQUFHO1FBQ2YsT0FBTyxFQUFFLEVBQUUsY0FBYyxFQUFFLGtCQUFrQixFQUFFO1FBQy9DLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO1lBQ25CLE9BQU87WUFDUCxNQUFNO1NBQ1AsQ0FBQztLQUNILENBQUM7QUFDSixDQUFDLENBQUM7QUFyRFcsUUFBQSxPQUFPLFdBcURsQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUdhdGV3YXlQcm94eUV2ZW50LCBBUElHYXRld2F5UHJveHlSZXN1bHQgfSBmcm9tIFwiYXdzLWxhbWJkYVwiO1xyXG5cclxuLyoqXHJcbiAqIERlY29kZSBhIEpXVCB3aXRob3V0IHZlcmlmaWNhdGlvbiAoZm9yIGRlbW8gb25seSkuXHJcbiAqIEluIHByb2R1Y3Rpb246IHZlcmlmeSBzaWduYXR1cmUgd2l0aCBqd2tzLlxyXG4gKi9cclxuZnVuY3Rpb24gZGVjb2RlSnd0KHRva2VuOiBzdHJpbmcpOiBhbnkgfCBudWxsIHtcclxuICB0cnkge1xyXG4gICAgY29uc3QgcGFydHMgPSB0b2tlbi5zcGxpdChcIi5cIik7XHJcbiAgICBpZiAocGFydHMubGVuZ3RoICE9PSAzKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICBjb25zdCBwYXlsb2FkID0gQnVmZmVyLmZyb20ocGFydHNbMV0sIFwiYmFzZTY0XCIpLnRvU3RyaW5nKFwidXRmOFwiKTtcclxuICAgIHJldHVybiBKU09OLnBhcnNlKHBheWxvYWQpO1xyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChcclxuICBldmVudDogQVBJR2F0ZXdheVByb3h5RXZlbnRcclxuKTogUHJvbWlzZTxBUElHYXRld2F5UHJveHlSZXN1bHQ+ID0+IHtcclxuICBjb25zdCBhdXRoSGVhZGVyID1cclxuICAgIGV2ZW50LmhlYWRlcnM/LkF1dGhvcml6YXRpb24gfHwgZXZlbnQuaGVhZGVycz8uYXV0aG9yaXphdGlvbjtcclxuXHJcbiAgLy8gTm8gdG9rZW4gLSB1bmF1dGhlbnRpY2F0ZWRcclxuICBpZiAoIWF1dGhIZWFkZXIgfHwgIWF1dGhIZWFkZXIuc3RhcnRzV2l0aChcIkJlYXJlciBcIikpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHN0YXR1c0NvZGU6IDIwMCxcclxuICAgICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxyXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgbWVzc2FnZTogXCJoaSB1ciBub3QgYXV0aGVudGljYXRlZFwiLFxyXG4gICAgICB9KSxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBjb25zdCB0b2tlbiA9IGF1dGhIZWFkZXIuc3Vic3RyaW5nKFwiQmVhcmVyIFwiLmxlbmd0aCk7XHJcbiAgY29uc3QgcGF5bG9hZCA9IGRlY29kZUp3dCh0b2tlbik7XHJcblxyXG4gIGlmICghcGF5bG9hZCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3RhdHVzQ29kZTogMjAwLFxyXG4gICAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXHJcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICBtZXNzYWdlOiBcImhpIHVyIG5vdCBhdXRoZW50aWNhdGVkIChpbnZhbGlkIHRva2VuKVwiLFxyXG4gICAgICB9KSxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvLyBDb2duaXRvIGdyb3VwcyBjb21lIGZyb20gdGhlIElEIHRva2VuIGNsYWltOiBjb2duaXRvOmdyb3Vwc1xyXG4gIGNvbnN0IHJhd0dyb3VwcyA9IHBheWxvYWRbXCJjb2duaXRvOmdyb3Vwc1wiXTtcclxuICBjb25zdCBncm91cHM6IHN0cmluZ1tdID0gQXJyYXkuaXNBcnJheShyYXdHcm91cHMpXHJcbiAgICA/IHJhd0dyb3Vwc1xyXG4gICAgOiB0eXBlb2YgcmF3R3JvdXBzID09PSBcInN0cmluZ1wiXHJcbiAgICA/IHJhd0dyb3Vwcy5zcGxpdChcIixcIilcclxuICAgIDogW107XHJcblxyXG4gIC8vIEJ1aWxkIG1lc3NhZ2UgZGVwZW5kaW5nIG9uIHJvbGVcclxuICBsZXQgbWVzc2FnZSA9IFwiaGkgdXIgYXV0aGVudGljYXRlZCBidXQgaGF2ZSBubyByb2xlXCI7XHJcblxyXG4gIGlmIChncm91cHMuaW5jbHVkZXMoXCJhZG1pblwiKSkgbWVzc2FnZSA9IFwiaGkgdXIgYWRtaW5cIjtcclxuICBlbHNlIGlmIChncm91cHMuaW5jbHVkZXMoXCJuZXdoaXJlXCIpKSBtZXNzYWdlID0gXCJoaSB1ciBuZXdoaXJlXCI7XHJcbiAgZWxzZSBpZiAoZ3JvdXBzLmluY2x1ZGVzKFwidmlzaXRvclwiKSkgbWVzc2FnZSA9IFwiaGkgdXIgdmlzaXRvclwiO1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgc3RhdHVzQ29kZTogMjAwLFxyXG4gICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxyXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICBtZXNzYWdlLFxyXG4gICAgICBncm91cHMsXHJcbiAgICB9KSxcclxuICB9O1xyXG59O1xyXG4iXX0=