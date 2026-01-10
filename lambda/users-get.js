"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const auth_1 = require("./utils/auth");
const http_response_1 = require("./http-response");
const client = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({});
const handler = async (event) => {
    try {
        if (event.httpMethod === "OPTIONS") {
            return (0, http_response_1.jsonResponse)(200, {});
        }
        if (!(0, auth_1.isAdmin)(event)) {
            return (0, http_response_1.jsonResponse)(403, {
                message: "Access denied. Not an Admin.",
            });
        }
        const command = new client_cognito_identity_provider_1.ListUsersCommand({
            UserPoolId: process.env.USER_POOL_ID,
        });
        const result = await client.send(command);
        return (0, http_response_1.jsonResponse)(200, {
            users: result.Users || [],
        });
    }
    catch (error) {
        console.error("Error getting users:", error);
        return (0, http_response_1.jsonResponse)(500, {
            message: "Failed to get users",
        });
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlcnMtZ2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidXNlcnMtZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLGdHQUdtRDtBQUNuRCx1Q0FBdUM7QUFDdkMsbURBQStDO0FBRS9DLE1BQU0sTUFBTSxHQUFHLElBQUksZ0VBQTZCLENBQUMsRUFBRSxDQUFDLENBQUM7QUFFOUMsTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUMxQixLQUEyQixFQUNLLEVBQUU7SUFDbEMsSUFBSSxDQUFDO1FBQ0gsSUFBSSxLQUFLLENBQUMsVUFBVSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ25DLE9BQU8sSUFBQSw0QkFBWSxFQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMvQixDQUFDO1FBRUQsSUFBSSxDQUFDLElBQUEsY0FBTyxFQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDcEIsT0FBTyxJQUFBLDRCQUFZLEVBQUMsR0FBRyxFQUFFO2dCQUN2QixPQUFPLEVBQUUsOEJBQThCO2FBQ3hDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBRyxJQUFJLG1EQUFnQixDQUFDO1lBQ25DLFVBQVUsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVk7U0FDckMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTFDLE9BQU8sSUFBQSw0QkFBWSxFQUFDLEdBQUcsRUFBRTtZQUN2QixLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUssSUFBSSxFQUFFO1NBQzFCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1FBQ3BCLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0JBQXNCLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDN0MsT0FBTyxJQUFBLDRCQUFZLEVBQUMsR0FBRyxFQUFFO1lBQ3ZCLE9BQU8sRUFBRSxxQkFBcUI7U0FDL0IsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztBQUNILENBQUMsQ0FBQztBQTdCVyxRQUFBLE9BQU8sV0E2QmxCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQVBJR2F0ZXdheVByb3h5RXZlbnQsIEFQSUdhdGV3YXlQcm94eVJlc3VsdCB9IGZyb20gXCJhd3MtbGFtYmRhXCI7XHJcbmltcG9ydCB7XHJcbiAgQ29nbml0b0lkZW50aXR5UHJvdmlkZXJDbGllbnQsXHJcbiAgTGlzdFVzZXJzQ29tbWFuZCxcclxufSBmcm9tIFwiQGF3cy1zZGsvY2xpZW50LWNvZ25pdG8taWRlbnRpdHktcHJvdmlkZXJcIjtcclxuaW1wb3J0IHsgaXNBZG1pbiB9IGZyb20gXCIuL3V0aWxzL2F1dGhcIjtcclxuaW1wb3J0IHsganNvblJlc3BvbnNlIH0gZnJvbSBcIi4vaHR0cC1yZXNwb25zZVwiO1xyXG5cclxuY29uc3QgY2xpZW50ID0gbmV3IENvZ25pdG9JZGVudGl0eVByb3ZpZGVyQ2xpZW50KHt9KTtcclxuXHJcbmV4cG9ydCBjb25zdCBoYW5kbGVyID0gYXN5bmMgKFxyXG4gIGV2ZW50OiBBUElHYXRld2F5UHJveHlFdmVudFxyXG4pOiBQcm9taXNlPEFQSUdhdGV3YXlQcm94eVJlc3VsdD4gPT4ge1xyXG4gIHRyeSB7XHJcbiAgICBpZiAoZXZlbnQuaHR0cE1ldGhvZCA9PT0gXCJPUFRJT05TXCIpIHtcclxuICAgICAgcmV0dXJuIGpzb25SZXNwb25zZSgyMDAsIHt9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWlzQWRtaW4oZXZlbnQpKSB7XHJcbiAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoNDAzLCB7XHJcbiAgICAgICAgbWVzc2FnZTogXCJBY2Nlc3MgZGVuaWVkLiBOb3QgYW4gQWRtaW4uXCIsXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgTGlzdFVzZXJzQ29tbWFuZCh7XHJcbiAgICAgIFVzZXJQb29sSWQ6IHByb2Nlc3MuZW52LlVTRVJfUE9PTF9JRCxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNsaWVudC5zZW5kKGNvbW1hbmQpO1xyXG5cclxuICAgIHJldHVybiBqc29uUmVzcG9uc2UoMjAwLCB7XHJcbiAgICAgIHVzZXJzOiByZXN1bHQuVXNlcnMgfHwgW10sXHJcbiAgICB9KTtcclxuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgZ2V0dGluZyB1c2VyczpcIiwgZXJyb3IpO1xyXG4gICAgcmV0dXJuIGpzb25SZXNwb25zZSg1MDAsIHtcclxuICAgICAgbWVzc2FnZTogXCJGYWlsZWQgdG8gZ2V0IHVzZXJzXCIsXHJcbiAgICB9KTtcclxuICB9XHJcbn07XHJcbiJdfQ==