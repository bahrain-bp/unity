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
        let userData = {};
        try {
            userData = event.body ? JSON.parse(event.body) : {};
        }
        catch {
            return (0, http_response_1.jsonResponse)(400, { message: "Invalid JSON body" });
        }
        const { email, temporaryPassword } = userData;
        if (!email) {
            return (0, http_response_1.jsonResponse)(400, { message: "Email is required" });
        }
        const input = {
            UserPoolId: process.env.USER_POOL_ID,
            Username: email,
            UserAttributes: [
                { Name: "email", Value: String(email) },
                { Name: "email_verified", Value: "true" },
            ],
            TemporaryPassword: temporaryPassword || "TempPass123!",
            MessageAction: "SUPPRESS",
        };
        const command = new client_cognito_identity_provider_1.AdminCreateUserCommand(input);
        const response = await client.send(command);
        return (0, http_response_1.jsonResponse)(201, {
            message: "User created successfully",
            user: {
                username: response.User?.Username,
                email,
                status: response.User?.UserStatus,
            },
        });
    }
    catch (error) {
        console.error("Error creating user:", error);
        return (0, http_response_1.jsonResponse)(500, {
            message: "Failed to create user",
        });
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlcnMtY3JlYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidXNlcnMtY3JlYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLGdHQUdtRDtBQUNuRCx1Q0FBdUM7QUFDdkMsbURBQStDO0FBRS9DLE1BQU0sTUFBTSxHQUFHLElBQUksZ0VBQTZCLENBQUMsRUFBRSxDQUFDLENBQUM7QUFFOUMsTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUMxQixLQUEyQixFQUNLLEVBQUU7SUFDbEMsSUFBSSxDQUFDO1FBQ0gsSUFBSSxLQUFLLENBQUMsVUFBVSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ25DLE9BQU8sSUFBQSw0QkFBWSxFQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMvQixDQUFDO1FBRUQsSUFBSSxDQUFDLElBQUEsY0FBTyxFQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDcEIsT0FBTyxJQUFBLDRCQUFZLEVBQUMsR0FBRyxFQUFFO2dCQUN2QixPQUFPLEVBQUUscUNBQXFDO2FBQy9DLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxJQUFJLFFBQVEsR0FBUSxFQUFFLENBQUM7UUFDdkIsSUFBSSxDQUFDO1lBQ0gsUUFBUSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDdEQsQ0FBQztRQUFDLE1BQU0sQ0FBQztZQUNQLE9BQU8sSUFBQSw0QkFBWSxFQUFDLEdBQUcsRUFBRSxFQUFFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxDQUFDLENBQUM7UUFDN0QsQ0FBQztRQUVELE1BQU0sRUFBRSxLQUFLLEVBQUUsaUJBQWlCLEVBQUUsR0FBRyxRQUFRLENBQUM7UUFFOUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1gsT0FBTyxJQUFBLDRCQUFZLEVBQUMsR0FBRyxFQUFFLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLENBQUMsQ0FBQztRQUM3RCxDQUFDO1FBRUQsTUFBTSxLQUFLLEdBQUc7WUFDWixVQUFVLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZO1lBQ3BDLFFBQVEsRUFBRSxLQUFLO1lBQ2YsY0FBYyxFQUFFO2dCQUNkLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUN2QyxFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFO2FBQzFDO1lBQ0QsaUJBQWlCLEVBQUUsaUJBQWlCLElBQUksY0FBYztZQUN0RCxhQUFhLEVBQUUsVUFBbUI7U0FDbkMsQ0FBQztRQUVGLE1BQU0sT0FBTyxHQUFHLElBQUkseURBQXNCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbEQsTUFBTSxRQUFRLEdBQUcsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTVDLE9BQU8sSUFBQSw0QkFBWSxFQUFDLEdBQUcsRUFBRTtZQUN2QixPQUFPLEVBQUUsMkJBQTJCO1lBQ3BDLElBQUksRUFBRTtnQkFDSixRQUFRLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxRQUFRO2dCQUNqQyxLQUFLO2dCQUNMLE1BQU0sRUFBRSxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVU7YUFDbEM7U0FDRixDQUFDLENBQUM7SUFDTCxDQUFDO0lBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztRQUNwQixPQUFPLENBQUMsS0FBSyxDQUFDLHNCQUFzQixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzdDLE9BQU8sSUFBQSw0QkFBWSxFQUFDLEdBQUcsRUFBRTtZQUN2QixPQUFPLEVBQUUsdUJBQXVCO1NBQ2pDLENBQUMsQ0FBQztJQUNMLENBQUM7QUFDSCxDQUFDLENBQUM7QUF2RFcsUUFBQSxPQUFPLFdBdURsQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUdhdGV3YXlQcm94eUV2ZW50LCBBUElHYXRld2F5UHJveHlSZXN1bHQgfSBmcm9tIFwiYXdzLWxhbWJkYVwiO1xyXG5pbXBvcnQge1xyXG4gIENvZ25pdG9JZGVudGl0eVByb3ZpZGVyQ2xpZW50LFxyXG4gIEFkbWluQ3JlYXRlVXNlckNvbW1hbmQsXHJcbn0gZnJvbSBcIkBhd3Mtc2RrL2NsaWVudC1jb2duaXRvLWlkZW50aXR5LXByb3ZpZGVyXCI7XHJcbmltcG9ydCB7IGlzQWRtaW4gfSBmcm9tIFwiLi91dGlscy9hdXRoXCI7XHJcbmltcG9ydCB7IGpzb25SZXNwb25zZSB9IGZyb20gXCIuL2h0dHAtcmVzcG9uc2VcIjtcclxuXHJcbmNvbnN0IGNsaWVudCA9IG5ldyBDb2duaXRvSWRlbnRpdHlQcm92aWRlckNsaWVudCh7fSk7XHJcblxyXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChcclxuICBldmVudDogQVBJR2F0ZXdheVByb3h5RXZlbnRcclxuKTogUHJvbWlzZTxBUElHYXRld2F5UHJveHlSZXN1bHQ+ID0+IHtcclxuICB0cnkge1xyXG4gICAgaWYgKGV2ZW50Lmh0dHBNZXRob2QgPT09IFwiT1BUSU9OU1wiKSB7XHJcbiAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoMjAwLCB7fSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFpc0FkbWluKGV2ZW50KSkge1xyXG4gICAgICByZXR1cm4ganNvblJlc3BvbnNlKDQwMywge1xyXG4gICAgICAgIG1lc3NhZ2U6IFwiQWNjZXNzIGRlbmllZC4gQWRtaW4gcm9sZSByZXF1aXJlZC5cIixcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IHVzZXJEYXRhOiBhbnkgPSB7fTtcclxuICAgIHRyeSB7XHJcbiAgICAgIHVzZXJEYXRhID0gZXZlbnQuYm9keSA/IEpTT04ucGFyc2UoZXZlbnQuYm9keSkgOiB7fTtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICByZXR1cm4ganNvblJlc3BvbnNlKDQwMCwgeyBtZXNzYWdlOiBcIkludmFsaWQgSlNPTiBib2R5XCIgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgeyBlbWFpbCwgdGVtcG9yYXJ5UGFzc3dvcmQgfSA9IHVzZXJEYXRhO1xyXG5cclxuICAgIGlmICghZW1haWwpIHtcclxuICAgICAgcmV0dXJuIGpzb25SZXNwb25zZSg0MDAsIHsgbWVzc2FnZTogXCJFbWFpbCBpcyByZXF1aXJlZFwiIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGlucHV0ID0ge1xyXG4gICAgICBVc2VyUG9vbElkOiBwcm9jZXNzLmVudi5VU0VSX1BPT0xfSUQsXHJcbiAgICAgIFVzZXJuYW1lOiBlbWFpbCxcclxuICAgICAgVXNlckF0dHJpYnV0ZXM6IFtcclxuICAgICAgICB7IE5hbWU6IFwiZW1haWxcIiwgVmFsdWU6IFN0cmluZyhlbWFpbCkgfSxcclxuICAgICAgICB7IE5hbWU6IFwiZW1haWxfdmVyaWZpZWRcIiwgVmFsdWU6IFwidHJ1ZVwiIH0sXHJcbiAgICAgIF0sXHJcbiAgICAgIFRlbXBvcmFyeVBhc3N3b3JkOiB0ZW1wb3JhcnlQYXNzd29yZCB8fCBcIlRlbXBQYXNzMTIzIVwiLFxyXG4gICAgICBNZXNzYWdlQWN0aW9uOiBcIlNVUFBSRVNTXCIgYXMgY29uc3QsXHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgQWRtaW5DcmVhdGVVc2VyQ29tbWFuZChpbnB1dCk7XHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNsaWVudC5zZW5kKGNvbW1hbmQpO1xyXG5cclxuICAgIHJldHVybiBqc29uUmVzcG9uc2UoMjAxLCB7XHJcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBjcmVhdGVkIHN1Y2Nlc3NmdWxseVwiLFxyXG4gICAgICB1c2VyOiB7XHJcbiAgICAgICAgdXNlcm5hbWU6IHJlc3BvbnNlLlVzZXI/LlVzZXJuYW1lLFxyXG4gICAgICAgIGVtYWlsLFxyXG4gICAgICAgIHN0YXR1czogcmVzcG9uc2UuVXNlcj8uVXNlclN0YXR1cyxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBjcmVhdGluZyB1c2VyOlwiLCBlcnJvcik7XHJcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKDUwMCwge1xyXG4gICAgICBtZXNzYWdlOiBcIkZhaWxlZCB0byBjcmVhdGUgdXNlclwiLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59O1xyXG4iXX0=