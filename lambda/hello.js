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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVsbG8uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJoZWxsby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBTyxNQUFNLE9BQU8sR0FBRyxLQUFLLEVBQUUsS0FBVSxFQUFFLEVBQUU7SUFDMUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFckQsaUNBQWlDO0lBQ2pDLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxjQUFjLEVBQUUsVUFBVSxFQUFFLE1BQU0sSUFBSSxFQUFFLENBQUM7SUFDOUQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQztJQUMzQixNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDO0lBRXZCLE1BQU0sWUFBWSxHQUFHO1FBQ25CLE9BQU8sRUFBRSx1QkFBdUI7UUFDaEMsSUFBSSxFQUFFO1lBQ0osR0FBRztZQUNILEtBQUs7U0FDTjtLQUNGLENBQUM7SUFFRixPQUFPO1FBQ0wsVUFBVSxFQUFFLEdBQUc7UUFDZixPQUFPLEVBQUU7WUFDUCxjQUFjLEVBQUUsa0JBQWtCO1lBQ2xDLG1CQUFtQjtZQUNuQiw2QkFBNkIsRUFBRSxHQUFHO1lBQ2xDLGtDQUFrQyxFQUFFLE1BQU07U0FDM0M7UUFDRCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUM7S0FDbkMsQ0FBQztBQUNKLENBQUMsQ0FBQztBQTFCVyxRQUFBLE9BQU8sV0EwQmxCIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IGhhbmRsZXIgPSBhc3luYyAoZXZlbnQ6IGFueSkgPT4ge1xuICBjb25zb2xlLmxvZyhcImV2ZW50XCIsIEpTT04uc3RyaW5naWZ5KGV2ZW50LCBudWxsLCAyKSk7XG5cbiAgLy8gQ2xhaW1zIGZyb20gQ29nbml0byBhdXRob3JpemVyXG4gIGNvbnN0IGNsYWltcyA9IGV2ZW50LnJlcXVlc3RDb250ZXh0Py5hdXRob3JpemVyPy5jbGFpbXMgfHwge307XG4gIGNvbnN0IGVtYWlsID0gY2xhaW1zLmVtYWlsO1xuICBjb25zdCBzdWIgPSBjbGFpbXMuc3ViO1xuXG4gIGNvbnN0IHJlc3BvbnNlQm9keSA9IHtcbiAgICBtZXNzYWdlOiBcIkhlbGxvIGZyb20gVW5pdHkgQVBJIVwiLFxuICAgIHVzZXI6IHtcbiAgICAgIHN1YixcbiAgICAgIGVtYWlsLFxuICAgIH0sXG4gIH07XG5cbiAgcmV0dXJuIHtcbiAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAvLyBDT1JTIGZvciBicm93c2VyXG4gICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiBcIipcIixcbiAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHNcIjogXCJ0cnVlXCIsXG4gICAgfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXNwb25zZUJvZHkpLFxuICB9O1xufTtcbiJdfQ==