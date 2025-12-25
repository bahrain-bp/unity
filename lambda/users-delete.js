"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const auth_1 = require("./utils/auth");
const cors_1 = require("./utils/cors");
const client = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({});
const handler = async (event) => {
    try {
        // Check if user is admin
        if (!(0, auth_1.isAdmin)(event)) {
            return (0, cors_1.createErrorResponse)(403, "Access denied. Admin role required.");
        }
        // Get userId from path parameters
        const userId = event.pathParameters?.userId;
        if (!userId) {
            return (0, cors_1.createErrorResponse)(400, "User ID is required");
        }
        // Create input for AdminDeleteUserCommand
        const input = {
            UserPoolId: process.env.USER_POOL_ID,
            Username: userId // This will be the email since we use email as username
        };
        const command = new client_cognito_identity_provider_1.AdminDeleteUserCommand(input);
        await client.send(command);
        return (0, cors_1.createResponse)(200, {
            message: "User deleted successfully",
            userId: userId
        });
    }
    catch (error) {
        console.error("Error deleting user:", error);
        return (0, cors_1.createErrorResponse)(500, "Failed to delete user");
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlcnMtZGVsZXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidXNlcnMtZGVsZXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLGdHQUFpSDtBQUNqSCx1Q0FBc0M7QUFDdEMsdUNBQWtFO0FBRWxFLE1BQU0sTUFBTSxHQUFHLElBQUksZ0VBQTZCLENBQUMsRUFBRSxDQUFDLENBQUE7QUFFN0MsTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUFFLEtBQTJCLEVBQWtDLEVBQUU7SUFDM0YsSUFBSSxDQUFDO1FBQ0gseUJBQXlCO1FBQ3pCLElBQUksQ0FBQyxJQUFBLGNBQU8sRUFBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3BCLE9BQU8sSUFBQSwwQkFBbUIsRUFBQyxHQUFHLEVBQUUscUNBQXFDLENBQUMsQ0FBQTtRQUN4RSxDQUFDO1FBRUQsa0NBQWtDO1FBQ2xDLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxjQUFjLEVBQUUsTUFBTSxDQUFBO1FBQzNDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNaLE9BQU8sSUFBQSwwQkFBbUIsRUFBQyxHQUFHLEVBQUUscUJBQXFCLENBQUMsQ0FBQTtRQUN4RCxDQUFDO1FBRUQsMENBQTBDO1FBQzFDLE1BQU0sS0FBSyxHQUFHO1lBQ1osVUFBVSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWTtZQUNwQyxRQUFRLEVBQUUsTUFBTSxDQUFFLHdEQUF3RDtTQUMzRSxDQUFBO1FBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSx5REFBc0IsQ0FBQyxLQUFLLENBQUMsQ0FBQTtRQUNqRCxNQUFNLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUE7UUFFMUIsT0FBTyxJQUFBLHFCQUFjLEVBQUMsR0FBRyxFQUFFO1lBQ3pCLE9BQU8sRUFBRSwyQkFBMkI7WUFDcEMsTUFBTSxFQUFFLE1BQU07U0FDZixDQUFDLENBQUE7SUFDSixDQUFDO0lBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztRQUNwQixPQUFPLENBQUMsS0FBSyxDQUFDLHNCQUFzQixFQUFFLEtBQUssQ0FBQyxDQUFBO1FBQzVDLE9BQU8sSUFBQSwwQkFBbUIsRUFBQyxHQUFHLEVBQUUsdUJBQXVCLENBQUMsQ0FBQTtJQUMxRCxDQUFDO0FBQ0gsQ0FBQyxDQUFBO0FBOUJZLFFBQUEsT0FBTyxXQThCbkIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBUElHYXRld2F5UHJveHlFdmVudCwgQVBJR2F0ZXdheVByb3h5UmVzdWx0IH0gZnJvbSBcImF3cy1sYW1iZGFcIlxyXG5pbXBvcnQgeyBDb2duaXRvSWRlbnRpdHlQcm92aWRlckNsaWVudCwgQWRtaW5EZWxldGVVc2VyQ29tbWFuZCB9IGZyb20gXCJAYXdzLXNkay9jbGllbnQtY29nbml0by1pZGVudGl0eS1wcm92aWRlclwiXHJcbmltcG9ydCB7IGlzQWRtaW4gfSBmcm9tIFwiLi91dGlscy9hdXRoXCJcclxuaW1wb3J0IHsgY3JlYXRlUmVzcG9uc2UsIGNyZWF0ZUVycm9yUmVzcG9uc2UgfSBmcm9tIFwiLi91dGlscy9jb3JzXCJcclxuXHJcbmNvbnN0IGNsaWVudCA9IG5ldyBDb2duaXRvSWRlbnRpdHlQcm92aWRlckNsaWVudCh7fSlcclxuXHJcbmV4cG9ydCBjb25zdCBoYW5kbGVyID0gYXN5bmMgKGV2ZW50OiBBUElHYXRld2F5UHJveHlFdmVudCk6IFByb21pc2U8QVBJR2F0ZXdheVByb3h5UmVzdWx0PiA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIC8vIENoZWNrIGlmIHVzZXIgaXMgYWRtaW5cclxuICAgIGlmICghaXNBZG1pbihldmVudCkpIHtcclxuICAgICAgcmV0dXJuIGNyZWF0ZUVycm9yUmVzcG9uc2UoNDAzLCBcIkFjY2VzcyBkZW5pZWQuIEFkbWluIHJvbGUgcmVxdWlyZWQuXCIpXHJcbiAgICB9XHJcblxyXG4gICAgLy8gR2V0IHVzZXJJZCBmcm9tIHBhdGggcGFyYW1ldGVyc1xyXG4gICAgY29uc3QgdXNlcklkID0gZXZlbnQucGF0aFBhcmFtZXRlcnM/LnVzZXJJZFxyXG4gICAgaWYgKCF1c2VySWQpIHtcclxuICAgICAgcmV0dXJuIGNyZWF0ZUVycm9yUmVzcG9uc2UoNDAwLCBcIlVzZXIgSUQgaXMgcmVxdWlyZWRcIilcclxuICAgIH1cclxuXHJcbiAgICAvLyBDcmVhdGUgaW5wdXQgZm9yIEFkbWluRGVsZXRlVXNlckNvbW1hbmRcclxuICAgIGNvbnN0IGlucHV0ID0ge1xyXG4gICAgICBVc2VyUG9vbElkOiBwcm9jZXNzLmVudi5VU0VSX1BPT0xfSUQsXHJcbiAgICAgIFVzZXJuYW1lOiB1c2VySWQgIC8vIFRoaXMgd2lsbCBiZSB0aGUgZW1haWwgc2luY2Ugd2UgdXNlIGVtYWlsIGFzIHVzZXJuYW1lXHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBBZG1pbkRlbGV0ZVVzZXJDb21tYW5kKGlucHV0KVxyXG4gICAgYXdhaXQgY2xpZW50LnNlbmQoY29tbWFuZClcclxuICAgIFxyXG4gICAgcmV0dXJuIGNyZWF0ZVJlc3BvbnNlKDIwMCwgeyBcclxuICAgICAgbWVzc2FnZTogXCJVc2VyIGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5XCIsXHJcbiAgICAgIHVzZXJJZDogdXNlcklkXHJcbiAgICB9KVxyXG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBkZWxldGluZyB1c2VyOlwiLCBlcnJvcilcclxuICAgIHJldHVybiBjcmVhdGVFcnJvclJlc3BvbnNlKDUwMCwgXCJGYWlsZWQgdG8gZGVsZXRlIHVzZXJcIilcclxuICB9XHJcbn1cclxuIl19