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
        // Parse request body
        const userData = JSON.parse(event.body || "{}");
        const { email } = userData;
        if (!email) {
            return (0, cors_1.createErrorResponse)(400, "Email is required");
        }
        // write input to pass to AdminUpdateUserAttributesCommand
        const input = {
            UserPoolId: process.env.USER_POOL_ID,
            Username: userId,
            UserAttributes: [
                { Name: "email", Value: email },
                { Name: "email_verified", Value: "true" }
            ]
        };
        const command = new client_cognito_identity_provider_1.AdminUpdateUserAttributesCommand(input);
        await client.send(command);
        return (0, cors_1.createResponse)(200, {
            message: "User updated successfully",
            userId: userId,
            email: email
        });
    }
    catch (error) {
        console.error("Error updating user:", error);
        return (0, cors_1.createErrorResponse)(500, "Failed to update user");
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlcnMtdXBkYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidXNlcnMtdXBkYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLGdHQUEySDtBQUMzSCx1Q0FBc0M7QUFDdEMsdUNBQWtFO0FBRWxFLE1BQU0sTUFBTSxHQUFHLElBQUksZ0VBQTZCLENBQUMsRUFBRSxDQUFDLENBQUE7QUFFN0MsTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUFFLEtBQTJCLEVBQWtDLEVBQUU7SUFDM0YsSUFBSSxDQUFDO1FBQ0gseUJBQXlCO1FBQ3pCLElBQUksQ0FBQyxJQUFBLGNBQU8sRUFBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3BCLE9BQU8sSUFBQSwwQkFBbUIsRUFBQyxHQUFHLEVBQUUscUNBQXFDLENBQUMsQ0FBQTtRQUN4RSxDQUFDO1FBRUQsa0NBQWtDO1FBQ2xDLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxjQUFjLEVBQUUsTUFBTSxDQUFBO1FBQzNDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNaLE9BQU8sSUFBQSwwQkFBbUIsRUFBQyxHQUFHLEVBQUUscUJBQXFCLENBQUMsQ0FBQTtRQUN4RCxDQUFDO1FBRUQscUJBQXFCO1FBQ3JCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQTtRQUMvQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsUUFBUSxDQUFBO1FBRTFCLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNYLE9BQU8sSUFBQSwwQkFBbUIsRUFBQyxHQUFHLEVBQUUsbUJBQW1CLENBQUMsQ0FBQTtRQUN0RCxDQUFDO1FBRUQsMERBQTBEO1FBQzFELE1BQU0sS0FBSyxHQUFHO1lBQ1osVUFBVSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWTtZQUNwQyxRQUFRLEVBQUUsTUFBTTtZQUNoQixjQUFjLEVBQUU7Z0JBQ2QsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUU7Z0JBQy9CLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUU7YUFDMUM7U0FDRixDQUFBO1FBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxtRUFBZ0MsQ0FBQyxLQUFLLENBQUMsQ0FBQTtRQUMzRCxNQUFNLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUE7UUFFMUIsT0FBTyxJQUFBLHFCQUFjLEVBQUMsR0FBRyxFQUFFO1lBQ3pCLE9BQU8sRUFBRSwyQkFBMkI7WUFDcEMsTUFBTSxFQUFFLE1BQU07WUFDZCxLQUFLLEVBQUUsS0FBSztTQUNiLENBQUMsQ0FBQTtJQUNKLENBQUM7SUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1FBQ3BCLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0JBQXNCLEVBQUUsS0FBSyxDQUFDLENBQUE7UUFDNUMsT0FBTyxJQUFBLDBCQUFtQixFQUFDLEdBQUcsRUFBRSx1QkFBdUIsQ0FBQyxDQUFBO0lBQzFELENBQUM7QUFDSCxDQUFDLENBQUE7QUEzQ1ksUUFBQSxPQUFPLFdBMkNuQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUdhdGV3YXlQcm94eUV2ZW50LCBBUElHYXRld2F5UHJveHlSZXN1bHQgfSBmcm9tIFwiYXdzLWxhbWJkYVwiXHJcbmltcG9ydCB7IENvZ25pdG9JZGVudGl0eVByb3ZpZGVyQ2xpZW50LCBBZG1pblVwZGF0ZVVzZXJBdHRyaWJ1dGVzQ29tbWFuZCB9IGZyb20gXCJAYXdzLXNkay9jbGllbnQtY29nbml0by1pZGVudGl0eS1wcm92aWRlclwiXHJcbmltcG9ydCB7IGlzQWRtaW4gfSBmcm9tIFwiLi91dGlscy9hdXRoXCJcclxuaW1wb3J0IHsgY3JlYXRlUmVzcG9uc2UsIGNyZWF0ZUVycm9yUmVzcG9uc2UgfSBmcm9tIFwiLi91dGlscy9jb3JzXCJcclxuXHJcbmNvbnN0IGNsaWVudCA9IG5ldyBDb2duaXRvSWRlbnRpdHlQcm92aWRlckNsaWVudCh7fSlcclxuXHJcbmV4cG9ydCBjb25zdCBoYW5kbGVyID0gYXN5bmMgKGV2ZW50OiBBUElHYXRld2F5UHJveHlFdmVudCk6IFByb21pc2U8QVBJR2F0ZXdheVByb3h5UmVzdWx0PiA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIC8vIENoZWNrIGlmIHVzZXIgaXMgYWRtaW5cclxuICAgIGlmICghaXNBZG1pbihldmVudCkpIHtcclxuICAgICAgcmV0dXJuIGNyZWF0ZUVycm9yUmVzcG9uc2UoNDAzLCBcIkFjY2VzcyBkZW5pZWQuIEFkbWluIHJvbGUgcmVxdWlyZWQuXCIpXHJcbiAgICB9XHJcblxyXG4gICAgLy8gR2V0IHVzZXJJZCBmcm9tIHBhdGggcGFyYW1ldGVyc1xyXG4gICAgY29uc3QgdXNlcklkID0gZXZlbnQucGF0aFBhcmFtZXRlcnM/LnVzZXJJZFxyXG4gICAgaWYgKCF1c2VySWQpIHtcclxuICAgICAgcmV0dXJuIGNyZWF0ZUVycm9yUmVzcG9uc2UoNDAwLCBcIlVzZXIgSUQgaXMgcmVxdWlyZWRcIilcclxuICAgIH1cclxuXHJcbiAgICAvLyBQYXJzZSByZXF1ZXN0IGJvZHlcclxuICAgIGNvbnN0IHVzZXJEYXRhID0gSlNPTi5wYXJzZShldmVudC5ib2R5IHx8IFwie31cIilcclxuICAgIGNvbnN0IHsgZW1haWwgfSA9IHVzZXJEYXRhXHJcblxyXG4gICAgaWYgKCFlbWFpbCkge1xyXG4gICAgICByZXR1cm4gY3JlYXRlRXJyb3JSZXNwb25zZSg0MDAsIFwiRW1haWwgaXMgcmVxdWlyZWRcIilcclxuICAgIH1cclxuXHJcbiAgICAvLyB3cml0ZSBpbnB1dCB0byBwYXNzIHRvIEFkbWluVXBkYXRlVXNlckF0dHJpYnV0ZXNDb21tYW5kXHJcbiAgICBjb25zdCBpbnB1dCA9IHtcclxuICAgICAgVXNlclBvb2xJZDogcHJvY2Vzcy5lbnYuVVNFUl9QT09MX0lELFxyXG4gICAgICBVc2VybmFtZTogdXNlcklkLFxyXG4gICAgICBVc2VyQXR0cmlidXRlczogW1xyXG4gICAgICAgIHsgTmFtZTogXCJlbWFpbFwiLCBWYWx1ZTogZW1haWwgfSxcclxuICAgICAgICB7IE5hbWU6IFwiZW1haWxfdmVyaWZpZWRcIiwgVmFsdWU6IFwidHJ1ZVwiIH1cclxuICAgICAgXVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgQWRtaW5VcGRhdGVVc2VyQXR0cmlidXRlc0NvbW1hbmQoaW5wdXQpXHJcbiAgICBhd2FpdCBjbGllbnQuc2VuZChjb21tYW5kKVxyXG4gICAgXHJcbiAgICByZXR1cm4gY3JlYXRlUmVzcG9uc2UoMjAwLCB7IFxyXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgdXBkYXRlZCBzdWNjZXNzZnVsbHlcIixcclxuICAgICAgdXNlcklkOiB1c2VySWQsXHJcbiAgICAgIGVtYWlsOiBlbWFpbFxyXG4gICAgfSlcclxuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgdXBkYXRpbmcgdXNlcjpcIiwgZXJyb3IpXHJcbiAgICByZXR1cm4gY3JlYXRlRXJyb3JSZXNwb25zZSg1MDAsIFwiRmFpbGVkIHRvIHVwZGF0ZSB1c2VyXCIpXHJcbiAgfVxyXG59XHJcbiJdfQ==