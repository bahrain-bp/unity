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
                message: "Access denied. Admin role required.",
            });
        }
        const userId = event.pathParameters?.userId;
        if (!userId) {
            return (0, http_response_1.jsonResponse)(400, { message: "User ID is required" });
        }
        const input = {
            UserPoolId: process.env.USER_POOL_ID,
            Username: userId,
        };
        const command = new client_cognito_identity_provider_1.AdminDeleteUserCommand(input);
        await client.send(command);
        return (0, http_response_1.jsonResponse)(200, {
            message: "User deleted successfully",
            userId,
        });
    }
    catch (error) {
        console.error("Error deleting user:", error);
        return (0, http_response_1.jsonResponse)(500, { message: "Failed to delete user" });
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlcnMtZGVsZXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidXNlcnMtZGVsZXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLGdHQUdtRDtBQUNuRCx1Q0FBdUM7QUFDdkMsbURBQStDO0FBRS9DLE1BQU0sTUFBTSxHQUFHLElBQUksZ0VBQTZCLENBQUMsRUFBRSxDQUFDLENBQUM7QUFFOUMsTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUMxQixLQUEyQixFQUNLLEVBQUU7SUFDbEMsSUFBSSxDQUFDO1FBQ0gsSUFBSSxLQUFLLENBQUMsVUFBVSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ25DLE9BQU8sSUFBQSw0QkFBWSxFQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMvQixDQUFDO1FBRUQsSUFBSSxDQUFDLElBQUEsY0FBTyxFQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDcEIsT0FBTyxJQUFBLDRCQUFZLEVBQUMsR0FBRyxFQUFFO2dCQUN2QixPQUFPLEVBQUUscUNBQXFDO2FBQy9DLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQztRQUM1QyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDWixPQUFPLElBQUEsNEJBQVksRUFBQyxHQUFHLEVBQUUsRUFBRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFFRCxNQUFNLEtBQUssR0FBRztZQUNaLFVBQVUsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVk7WUFDcEMsUUFBUSxFQUFFLE1BQU07U0FDakIsQ0FBQztRQUVGLE1BQU0sT0FBTyxHQUFHLElBQUkseURBQXNCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbEQsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTNCLE9BQU8sSUFBQSw0QkFBWSxFQUFDLEdBQUcsRUFBRTtZQUN2QixPQUFPLEVBQUUsMkJBQTJCO1lBQ3BDLE1BQU07U0FDUCxDQUFDLENBQUM7SUFDTCxDQUFDO0lBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztRQUNwQixPQUFPLENBQUMsS0FBSyxDQUFDLHNCQUFzQixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzdDLE9BQU8sSUFBQSw0QkFBWSxFQUFDLEdBQUcsRUFBRSxFQUFFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxDQUFDLENBQUM7SUFDakUsQ0FBQztBQUNILENBQUMsQ0FBQztBQW5DVyxRQUFBLE9BQU8sV0FtQ2xCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQVBJR2F0ZXdheVByb3h5RXZlbnQsIEFQSUdhdGV3YXlQcm94eVJlc3VsdCB9IGZyb20gXCJhd3MtbGFtYmRhXCI7XHJcbmltcG9ydCB7XHJcbiAgQ29nbml0b0lkZW50aXR5UHJvdmlkZXJDbGllbnQsXHJcbiAgQWRtaW5EZWxldGVVc2VyQ29tbWFuZCxcclxufSBmcm9tIFwiQGF3cy1zZGsvY2xpZW50LWNvZ25pdG8taWRlbnRpdHktcHJvdmlkZXJcIjtcclxuaW1wb3J0IHsgaXNBZG1pbiB9IGZyb20gXCIuL3V0aWxzL2F1dGhcIjtcclxuaW1wb3J0IHsganNvblJlc3BvbnNlIH0gZnJvbSBcIi4vaHR0cC1yZXNwb25zZVwiO1xyXG5cclxuY29uc3QgY2xpZW50ID0gbmV3IENvZ25pdG9JZGVudGl0eVByb3ZpZGVyQ2xpZW50KHt9KTtcclxuXHJcbmV4cG9ydCBjb25zdCBoYW5kbGVyID0gYXN5bmMgKFxyXG4gIGV2ZW50OiBBUElHYXRld2F5UHJveHlFdmVudFxyXG4pOiBQcm9taXNlPEFQSUdhdGV3YXlQcm94eVJlc3VsdD4gPT4ge1xyXG4gIHRyeSB7XHJcbiAgICBpZiAoZXZlbnQuaHR0cE1ldGhvZCA9PT0gXCJPUFRJT05TXCIpIHtcclxuICAgICAgcmV0dXJuIGpzb25SZXNwb25zZSgyMDAsIHt9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWlzQWRtaW4oZXZlbnQpKSB7XHJcbiAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoNDAzLCB7XHJcbiAgICAgICAgbWVzc2FnZTogXCJBY2Nlc3MgZGVuaWVkLiBBZG1pbiByb2xlIHJlcXVpcmVkLlwiLFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB1c2VySWQgPSBldmVudC5wYXRoUGFyYW1ldGVycz8udXNlcklkO1xyXG4gICAgaWYgKCF1c2VySWQpIHtcclxuICAgICAgcmV0dXJuIGpzb25SZXNwb25zZSg0MDAsIHsgbWVzc2FnZTogXCJVc2VyIElEIGlzIHJlcXVpcmVkXCIgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgaW5wdXQgPSB7XHJcbiAgICAgIFVzZXJQb29sSWQ6IHByb2Nlc3MuZW52LlVTRVJfUE9PTF9JRCxcclxuICAgICAgVXNlcm5hbWU6IHVzZXJJZCwgXHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgQWRtaW5EZWxldGVVc2VyQ29tbWFuZChpbnB1dCk7XHJcbiAgICBhd2FpdCBjbGllbnQuc2VuZChjb21tYW5kKTtcclxuXHJcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKDIwMCwge1xyXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgZGVsZXRlZCBzdWNjZXNzZnVsbHlcIixcclxuICAgICAgdXNlcklkLFxyXG4gICAgfSk7XHJcbiAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgY29uc29sZS5lcnJvcihcIkVycm9yIGRlbGV0aW5nIHVzZXI6XCIsIGVycm9yKTtcclxuICAgIHJldHVybiBqc29uUmVzcG9uc2UoNTAwLCB7IG1lc3NhZ2U6IFwiRmFpbGVkIHRvIGRlbGV0ZSB1c2VyXCIgfSk7XHJcbiAgfVxyXG59O1xyXG4iXX0=