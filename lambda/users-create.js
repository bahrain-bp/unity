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
        const userData = JSON.parse(event.body || "{}");
        const { email, temporaryPassword } = userData;
        if (!email) {
            return (0, cors_1.createErrorResponse)(400, "Email is required");
        }
        // Write input needed to pass to AdminCreateUserCommand (use email as username)
        const input = {
            UserPoolId: process.env.USER_POOL_ID,
            Username: email,
            UserAttributes: [
                { Name: "email", Value: email },
                { Name: "email_verified", Value: "true" }
            ],
            TemporaryPassword: temporaryPassword || "TempPass123!",
            MessageAction: "SUPPRESS"
        };
        const command = new client_cognito_identity_provider_1.AdminCreateUserCommand(input);
        const response = await client.send(command);
        return (0, cors_1.createResponse)(201, {
            message: "User created successfully",
            user: {
                username: response.User?.Username,
                email: email,
                status: response.User?.UserStatus
            }
        });
    }
    catch (error) {
        console.error("Error creating user:", error);
        return (0, cors_1.createErrorResponse)(500, "Failed to create user");
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlcnMtY3JlYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidXNlcnMtY3JlYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLGdHQUFpSDtBQUNqSCx1Q0FBc0M7QUFDdEMsdUNBQWtFO0FBRWxFLE1BQU0sTUFBTSxHQUFHLElBQUksZ0VBQTZCLENBQUMsRUFBRSxDQUFDLENBQUE7QUFFN0MsTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUFFLEtBQTJCLEVBQWtDLEVBQUU7SUFDM0YsSUFBSSxDQUFDO1FBQ0gseUJBQXlCO1FBQ3pCLElBQUksQ0FBQyxJQUFBLGNBQU8sRUFBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3BCLE9BQU8sSUFBQSwwQkFBbUIsRUFBQyxHQUFHLEVBQUUscUNBQXFDLENBQUMsQ0FBQTtRQUN4RSxDQUFDO1FBRUQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFBO1FBQy9DLE1BQU0sRUFBRSxLQUFLLEVBQUUsaUJBQWlCLEVBQUUsR0FBRyxRQUFRLENBQUE7UUFFN0MsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1gsT0FBTyxJQUFBLDBCQUFtQixFQUFDLEdBQUcsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFFRCwrRUFBK0U7UUFDL0UsTUFBTSxLQUFLLEdBQUc7WUFDWixVQUFVLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZO1lBQ3BDLFFBQVEsRUFBRSxLQUFLO1lBQ2YsY0FBYyxFQUFFO2dCQUNkLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFO2dCQUMvQixFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFO2FBQzFDO1lBQ0QsaUJBQWlCLEVBQUUsaUJBQWlCLElBQUksY0FBYztZQUN0RCxhQUFhLEVBQUUsVUFBbUI7U0FDbkMsQ0FBQTtRQUVELE1BQU0sT0FBTyxHQUFHLElBQUkseURBQXNCLENBQUMsS0FBSyxDQUFDLENBQUE7UUFDakQsTUFBTSxRQUFRLEdBQUcsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBRTNDLE9BQU8sSUFBQSxxQkFBYyxFQUFDLEdBQUcsRUFBRTtZQUN6QixPQUFPLEVBQUUsMkJBQTJCO1lBQ3BDLElBQUksRUFBRTtnQkFDSixRQUFRLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxRQUFRO2dCQUNqQyxLQUFLLEVBQUUsS0FBSztnQkFDWixNQUFNLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxVQUFVO2FBQ2xDO1NBQ0YsQ0FBQyxDQUFBO0lBQ0osQ0FBQztJQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7UUFDcEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUM1QyxPQUFPLElBQUEsMEJBQW1CLEVBQUMsR0FBRyxFQUFFLHVCQUF1QixDQUFDLENBQUE7SUFDMUQsQ0FBQztBQUNILENBQUMsQ0FBQTtBQXpDWSxRQUFBLE9BQU8sV0F5Q25CIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQVBJR2F0ZXdheVByb3h5RXZlbnQsIEFQSUdhdGV3YXlQcm94eVJlc3VsdCB9IGZyb20gXCJhd3MtbGFtYmRhXCJcclxuaW1wb3J0IHsgQ29nbml0b0lkZW50aXR5UHJvdmlkZXJDbGllbnQsIEFkbWluQ3JlYXRlVXNlckNvbW1hbmQgfSBmcm9tIFwiQGF3cy1zZGsvY2xpZW50LWNvZ25pdG8taWRlbnRpdHktcHJvdmlkZXJcIlxyXG5pbXBvcnQgeyBpc0FkbWluIH0gZnJvbSBcIi4vdXRpbHMvYXV0aFwiXHJcbmltcG9ydCB7IGNyZWF0ZVJlc3BvbnNlLCBjcmVhdGVFcnJvclJlc3BvbnNlIH0gZnJvbSBcIi4vdXRpbHMvY29yc1wiXHJcblxyXG5jb25zdCBjbGllbnQgPSBuZXcgQ29nbml0b0lkZW50aXR5UHJvdmlkZXJDbGllbnQoe30pXHJcblxyXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChldmVudDogQVBJR2F0ZXdheVByb3h5RXZlbnQpOiBQcm9taXNlPEFQSUdhdGV3YXlQcm94eVJlc3VsdD4gPT4ge1xyXG4gIHRyeSB7XHJcbiAgICAvLyBDaGVjayBpZiB1c2VyIGlzIGFkbWluXHJcbiAgICBpZiAoIWlzQWRtaW4oZXZlbnQpKSB7XHJcbiAgICAgIHJldHVybiBjcmVhdGVFcnJvclJlc3BvbnNlKDQwMywgXCJBY2Nlc3MgZGVuaWVkLiBBZG1pbiByb2xlIHJlcXVpcmVkLlwiKVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHVzZXJEYXRhID0gSlNPTi5wYXJzZShldmVudC5ib2R5IHx8IFwie31cIilcclxuICAgIGNvbnN0IHsgZW1haWwsIHRlbXBvcmFyeVBhc3N3b3JkIH0gPSB1c2VyRGF0YVxyXG5cclxuICAgIGlmICghZW1haWwpIHtcclxuICAgICAgcmV0dXJuIGNyZWF0ZUVycm9yUmVzcG9uc2UoNDAwLCBcIkVtYWlsIGlzIHJlcXVpcmVkXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFdyaXRlIGlucHV0IG5lZWRlZCB0byBwYXNzIHRvIEFkbWluQ3JlYXRlVXNlckNvbW1hbmQgKHVzZSBlbWFpbCBhcyB1c2VybmFtZSlcclxuICAgIGNvbnN0IGlucHV0ID0ge1xyXG4gICAgICBVc2VyUG9vbElkOiBwcm9jZXNzLmVudi5VU0VSX1BPT0xfSUQsXHJcbiAgICAgIFVzZXJuYW1lOiBlbWFpbCxcclxuICAgICAgVXNlckF0dHJpYnV0ZXM6IFtcclxuICAgICAgICB7IE5hbWU6IFwiZW1haWxcIiwgVmFsdWU6IGVtYWlsIH0sXHJcbiAgICAgICAgeyBOYW1lOiBcImVtYWlsX3ZlcmlmaWVkXCIsIFZhbHVlOiBcInRydWVcIiB9XHJcbiAgICAgIF0sXHJcbiAgICAgIFRlbXBvcmFyeVBhc3N3b3JkOiB0ZW1wb3JhcnlQYXNzd29yZCB8fCBcIlRlbXBQYXNzMTIzIVwiLFxyXG4gICAgICBNZXNzYWdlQWN0aW9uOiBcIlNVUFBSRVNTXCIgYXMgY29uc3RcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjb21tYW5kID0gbmV3IEFkbWluQ3JlYXRlVXNlckNvbW1hbmQoaW5wdXQpXHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNsaWVudC5zZW5kKGNvbW1hbmQpXHJcbiAgICBcclxuICAgIHJldHVybiBjcmVhdGVSZXNwb25zZSgyMDEsIHsgXHJcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBjcmVhdGVkIHN1Y2Nlc3NmdWxseVwiLFxyXG4gICAgICB1c2VyOiB7XHJcbiAgICAgICAgdXNlcm5hbWU6IHJlc3BvbnNlLlVzZXI/LlVzZXJuYW1lLFxyXG4gICAgICAgIGVtYWlsOiBlbWFpbCxcclxuICAgICAgICBzdGF0dXM6IHJlc3BvbnNlLlVzZXI/LlVzZXJTdGF0dXNcclxuICAgICAgfVxyXG4gICAgfSlcclxuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgY3JlYXRpbmcgdXNlcjpcIiwgZXJyb3IpXHJcbiAgICByZXR1cm4gY3JlYXRlRXJyb3JSZXNwb25zZSg1MDAsIFwiRmFpbGVkIHRvIGNyZWF0ZSB1c2VyXCIpXHJcbiAgfVxyXG59XHJcbiJdfQ==