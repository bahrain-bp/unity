"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const handler = async (event) => {
    console.log("event", JSON.stringify(event, null, 2));
    // Claims from Cognito authorizer
    const claims = event.requestContext?.authorizer?.claims || {};
    const email = claims.email;
    const sub = claims.sub;
    const responseBody = {
        message: "Hello from Unity API!",
        user: {
            sub,
            email,
        },
    };
    return {
        statusCode: 200,
        headers: {
            "Content-Type": "application/json",
            // CORS for browser
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify(responseBody),
    };
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVsbG8uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJoZWxsby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBTyxNQUFNLE9BQU8sR0FBRyxLQUFLLEVBQUUsS0FBVSxFQUFFLEVBQUU7SUFDMUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFckQsaUNBQWlDO0lBQ2pDLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxjQUFjLEVBQUUsVUFBVSxFQUFFLE1BQU0sSUFBSSxFQUFFLENBQUM7SUFDOUQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQztJQUMzQixNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDO0lBRXZCLE1BQU0sWUFBWSxHQUFHO1FBQ25CLE9BQU8sRUFBRSx1QkFBdUI7UUFDaEMsSUFBSSxFQUFFO1lBQ0osR0FBRztZQUNILEtBQUs7U0FDTjtLQUNGLENBQUM7SUFFRixPQUFPO1FBQ0wsVUFBVSxFQUFFLEdBQUc7UUFDZixPQUFPLEVBQUU7WUFDUCxjQUFjLEVBQUUsa0JBQWtCO1lBQ2xDLG1CQUFtQjtZQUNuQiw2QkFBNkIsRUFBRSxHQUFHO1lBQ2xDLGtDQUFrQyxFQUFFLE1BQU07U0FDM0M7UUFDRCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUM7S0FDbkMsQ0FBQztBQUNKLENBQUMsQ0FBQztBQTFCVyxRQUFBLE9BQU8sV0EwQmxCIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IGhhbmRsZXIgPSBhc3luYyAoZXZlbnQ6IGFueSkgPT4ge1xyXG4gIGNvbnNvbGUubG9nKFwiZXZlbnRcIiwgSlNPTi5zdHJpbmdpZnkoZXZlbnQsIG51bGwsIDIpKTtcclxuXHJcbiAgLy8gQ2xhaW1zIGZyb20gQ29nbml0byBhdXRob3JpemVyXHJcbiAgY29uc3QgY2xhaW1zID0gZXZlbnQucmVxdWVzdENvbnRleHQ/LmF1dGhvcml6ZXI/LmNsYWltcyB8fCB7fTtcclxuICBjb25zdCBlbWFpbCA9IGNsYWltcy5lbWFpbDtcclxuICBjb25zdCBzdWIgPSBjbGFpbXMuc3ViO1xyXG5cclxuICBjb25zdCByZXNwb25zZUJvZHkgPSB7XHJcbiAgICBtZXNzYWdlOiBcIkhlbGxvIGZyb20gVW5pdHkgQVBJIVwiLFxyXG4gICAgdXNlcjoge1xyXG4gICAgICBzdWIsXHJcbiAgICAgIGVtYWlsLFxyXG4gICAgfSxcclxuICB9O1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgc3RhdHVzQ29kZTogMjAwLFxyXG4gICAgaGVhZGVyczoge1xyXG4gICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcclxuICAgICAgLy8gQ09SUyBmb3IgYnJvd3NlclxyXG4gICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiBcIipcIixcclxuICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFsc1wiOiBcInRydWVcIixcclxuICAgIH0sXHJcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXNwb25zZUJvZHkpLFxyXG4gIH07XHJcbn07XHJcbiJdfQ==