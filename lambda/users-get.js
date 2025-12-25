"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const auth_1 = require("./utils/auth");
const cors_1 = require("./utils/cors");
const client = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({});
const handler = async (event) => {
    try {
        if (!(0, auth_1.isAdmin)(event)) {
            return (0, cors_1.createErrorResponse)(403, "Access denied. Not an Admin.");
        }
        // List all users from Cognito
        const command = new client_cognito_identity_provider_1.ListUsersCommand({
            UserPoolId: process.env.USER_POOL_ID,
        });
        const result = await client.send(command);
        return (0, cors_1.createResponse)(200, { users: result.Users || [] });
    }
    catch (error) {
        console.error("Error getting users:", error);
        return (0, cors_1.createErrorResponse)(500, "Failed to get users");
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlcnMtZ2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidXNlcnMtZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLGdHQUEyRztBQUMzRyx1Q0FBc0M7QUFDdEMsdUNBQWtFO0FBRWxFLE1BQU0sTUFBTSxHQUFHLElBQUksZ0VBQTZCLENBQUMsRUFBRSxDQUFDLENBQUE7QUFFN0MsTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUFFLEtBQTJCLEVBQWtDLEVBQUU7SUFDM0YsSUFBSSxDQUFDO1FBQ0gsSUFBSSxDQUFDLElBQUEsY0FBTyxFQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDcEIsT0FBTyxJQUFBLDBCQUFtQixFQUFDLEdBQUcsRUFBRSw4QkFBOEIsQ0FBQyxDQUFBO1FBQ2pFLENBQUM7UUFFRCw4QkFBOEI7UUFDOUIsTUFBTSxPQUFPLEdBQUcsSUFBSSxtREFBZ0IsQ0FBQztZQUNuQyxVQUFVLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZO1NBQ3JDLENBQUMsQ0FBQTtRQUVGLE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUV6QyxPQUFPLElBQUEscUJBQWMsRUFBQyxHQUFHLEVBQUUsRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUssSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFBO0lBQzNELENBQUM7SUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1FBQ3BCLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0JBQXNCLEVBQUUsS0FBSyxDQUFDLENBQUE7UUFDNUMsT0FBTyxJQUFBLDBCQUFtQixFQUFDLEdBQUcsRUFBRSxxQkFBcUIsQ0FBQyxDQUFBO0lBQ3hELENBQUM7QUFDSCxDQUFDLENBQUE7QUFsQlksUUFBQSxPQUFPLFdBa0JuQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUdhdGV3YXlQcm94eUV2ZW50LCBBUElHYXRld2F5UHJveHlSZXN1bHQgfSBmcm9tIFwiYXdzLWxhbWJkYVwiXHJcbmltcG9ydCB7IENvZ25pdG9JZGVudGl0eVByb3ZpZGVyQ2xpZW50LCBMaXN0VXNlcnNDb21tYW5kIH0gZnJvbSBcIkBhd3Mtc2RrL2NsaWVudC1jb2duaXRvLWlkZW50aXR5LXByb3ZpZGVyXCJcclxuaW1wb3J0IHsgaXNBZG1pbiB9IGZyb20gXCIuL3V0aWxzL2F1dGhcIlxyXG5pbXBvcnQgeyBjcmVhdGVSZXNwb25zZSwgY3JlYXRlRXJyb3JSZXNwb25zZSB9IGZyb20gXCIuL3V0aWxzL2NvcnNcIlxyXG5cclxuY29uc3QgY2xpZW50ID0gbmV3IENvZ25pdG9JZGVudGl0eVByb3ZpZGVyQ2xpZW50KHt9KVxyXG5cclxuZXhwb3J0IGNvbnN0IGhhbmRsZXIgPSBhc3luYyAoZXZlbnQ6IEFQSUdhdGV3YXlQcm94eUV2ZW50KTogUHJvbWlzZTxBUElHYXRld2F5UHJveHlSZXN1bHQ+ID0+IHtcclxuICB0cnkgeyAgICBcclxuICAgIGlmICghaXNBZG1pbihldmVudCkpIHtcclxuICAgICAgcmV0dXJuIGNyZWF0ZUVycm9yUmVzcG9uc2UoNDAzLCBcIkFjY2VzcyBkZW5pZWQuIE5vdCBhbiBBZG1pbi5cIilcclxuICAgIH1cclxuXHJcbiAgICAvLyBMaXN0IGFsbCB1c2VycyBmcm9tIENvZ25pdG9cclxuICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgTGlzdFVzZXJzQ29tbWFuZCh7XHJcbiAgICAgIFVzZXJQb29sSWQ6IHByb2Nlc3MuZW52LlVTRVJfUE9PTF9JRCxcclxuICAgIH0pXHJcbiAgICBcclxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNsaWVudC5zZW5kKGNvbW1hbmQpXHJcbiAgICBcclxuICAgIHJldHVybiBjcmVhdGVSZXNwb25zZSgyMDAsIHsgdXNlcnM6IHJlc3VsdC5Vc2VycyB8fCBbXSB9KVxyXG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBnZXR0aW5nIHVzZXJzOlwiLCBlcnJvcilcclxuICAgIHJldHVybiBjcmVhdGVFcnJvclJlc3BvbnNlKDUwMCwgXCJGYWlsZWQgdG8gZ2V0IHVzZXJzXCIpXHJcbiAgfVxyXG59XHJcbiJdfQ==