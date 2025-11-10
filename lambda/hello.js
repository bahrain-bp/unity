"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const handler = async (event) => {
    console.log('event', JSON.stringify(event, null, 2));
    // For REST API + Cognito User Pool authorizer:
    const claims = event.requestContext?.authorizer?.claims || {};
    const email = claims.email;
    const sub = claims.sub; // Cognito user id
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: 'Hello from Unity API!',
            user: {
                email,
                sub,
            },
        }),
    };
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVsbG8uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJoZWxsby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBTyxNQUFNLE9BQU8sR0FBRyxLQUFLLEVBQUUsS0FBVSxFQUFFLEVBQUU7SUFDMUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFckQsK0NBQStDO0lBQy9DLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxjQUFjLEVBQUUsVUFBVSxFQUFFLE1BQU0sSUFBSSxFQUFFLENBQUM7SUFDOUQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQztJQUMzQixNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsa0JBQWtCO0lBRTFDLE9BQU87UUFDTCxVQUFVLEVBQUUsR0FBRztRQUNmLE9BQU8sRUFBRSxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRTtRQUMvQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUNuQixPQUFPLEVBQUUsdUJBQXVCO1lBQ2hDLElBQUksRUFBRTtnQkFDSixLQUFLO2dCQUNMLEdBQUc7YUFDSjtTQUNGLENBQUM7S0FDSCxDQUFDO0FBQ0osQ0FBQyxDQUFDO0FBbkJXLFFBQUEsT0FBTyxXQW1CbEIiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChldmVudDogYW55KSA9PiB7XG4gIGNvbnNvbGUubG9nKCdldmVudCcsIEpTT04uc3RyaW5naWZ5KGV2ZW50LCBudWxsLCAyKSk7XG5cbiAgLy8gRm9yIFJFU1QgQVBJICsgQ29nbml0byBVc2VyIFBvb2wgYXV0aG9yaXplcjpcbiAgY29uc3QgY2xhaW1zID0gZXZlbnQucmVxdWVzdENvbnRleHQ/LmF1dGhvcml6ZXI/LmNsYWltcyB8fCB7fTtcbiAgY29uc3QgZW1haWwgPSBjbGFpbXMuZW1haWw7XG4gIGNvbnN0IHN1YiA9IGNsYWltcy5zdWI7IC8vIENvZ25pdG8gdXNlciBpZFxuXG4gIHJldHVybiB7XG4gICAgc3RhdHVzQ29kZTogMjAwLFxuICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIG1lc3NhZ2U6ICdIZWxsbyBmcm9tIFVuaXR5IEFQSSEnLFxuICAgICAgdXNlcjoge1xuICAgICAgICBlbWFpbCxcbiAgICAgICAgc3ViLFxuICAgICAgfSxcbiAgICB9KSxcbiAgfTtcbn07XG4iXX0=