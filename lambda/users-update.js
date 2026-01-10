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
        let userData = {};
        try {
            userData = event.body ? JSON.parse(event.body) : {};
        }
        catch {
            return (0, http_response_1.jsonResponse)(400, { message: "Invalid JSON body" });
        }
        const email = userData?.email;
        if (!email) {
            return (0, http_response_1.jsonResponse)(400, { message: "Email is required" });
        }
        const input = {
            UserPoolId: process.env.USER_POOL_ID,
            Username: userId,
            UserAttributes: [
                { Name: "email", Value: String(email) },
                { Name: "email_verified", Value: "true" },
            ],
        };
        const command = new client_cognito_identity_provider_1.AdminUpdateUserAttributesCommand(input);
        await client.send(command);
        return (0, http_response_1.jsonResponse)(200, {
            message: "User updated successfully",
            userId,
            email,
        });
    }
    catch (error) {
        console.error("Error updating user:", error);
        return (0, http_response_1.jsonResponse)(500, { message: "Failed to update user" });
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlcnMtdXBkYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidXNlcnMtdXBkYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLGdHQUdtRDtBQUNuRCx1Q0FBdUM7QUFDdkMsbURBQStDO0FBRS9DLE1BQU0sTUFBTSxHQUFHLElBQUksZ0VBQTZCLENBQUMsRUFBRSxDQUFDLENBQUM7QUFFOUMsTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUMxQixLQUEyQixFQUNLLEVBQUU7SUFDbEMsSUFBSSxDQUFDO1FBQ0gsSUFBSSxLQUFLLENBQUMsVUFBVSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ25DLE9BQU8sSUFBQSw0QkFBWSxFQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMvQixDQUFDO1FBRUQsSUFBSSxDQUFDLElBQUEsY0FBTyxFQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDcEIsT0FBTyxJQUFBLDRCQUFZLEVBQUMsR0FBRyxFQUFFO2dCQUN2QixPQUFPLEVBQUUscUNBQXFDO2FBQy9DLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQztRQUM1QyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDWixPQUFPLElBQUEsNEJBQVksRUFBQyxHQUFHLEVBQUUsRUFBRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFFRCxJQUFJLFFBQVEsR0FBUSxFQUFFLENBQUM7UUFDdkIsSUFBSSxDQUFDO1lBQ0gsUUFBUSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDdEQsQ0FBQztRQUFDLE1BQU0sQ0FBQztZQUNQLE9BQU8sSUFBQSw0QkFBWSxFQUFDLEdBQUcsRUFBRSxFQUFFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxDQUFDLENBQUM7UUFDN0QsQ0FBQztRQUVELE1BQU0sS0FBSyxHQUFHLFFBQVEsRUFBRSxLQUFLLENBQUM7UUFDOUIsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1gsT0FBTyxJQUFBLDRCQUFZLEVBQUMsR0FBRyxFQUFFLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLENBQUMsQ0FBQztRQUM3RCxDQUFDO1FBRUQsTUFBTSxLQUFLLEdBQUc7WUFDWixVQUFVLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZO1lBQ3BDLFFBQVEsRUFBRSxNQUFNO1lBQ2hCLGNBQWMsRUFBRTtnQkFDZCxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDdkMsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRTthQUMxQztTQUNGLENBQUM7UUFFRixNQUFNLE9BQU8sR0FBRyxJQUFJLG1FQUFnQyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzVELE1BQU0sTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUUzQixPQUFPLElBQUEsNEJBQVksRUFBQyxHQUFHLEVBQUU7WUFDdkIsT0FBTyxFQUFFLDJCQUEyQjtZQUNwQyxNQUFNO1lBQ04sS0FBSztTQUNOLENBQUMsQ0FBQztJQUNMLENBQUM7SUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1FBQ3BCLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0JBQXNCLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDN0MsT0FBTyxJQUFBLDRCQUFZLEVBQUMsR0FBRyxFQUFFLEVBQUUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLENBQUMsQ0FBQztJQUNqRSxDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBcERXLFFBQUEsT0FBTyxXQW9EbEIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBUElHYXRld2F5UHJveHlFdmVudCwgQVBJR2F0ZXdheVByb3h5UmVzdWx0IH0gZnJvbSBcImF3cy1sYW1iZGFcIjtcclxuaW1wb3J0IHtcclxuICBDb2duaXRvSWRlbnRpdHlQcm92aWRlckNsaWVudCxcclxuICBBZG1pblVwZGF0ZVVzZXJBdHRyaWJ1dGVzQ29tbWFuZCxcclxufSBmcm9tIFwiQGF3cy1zZGsvY2xpZW50LWNvZ25pdG8taWRlbnRpdHktcHJvdmlkZXJcIjtcclxuaW1wb3J0IHsgaXNBZG1pbiB9IGZyb20gXCIuL3V0aWxzL2F1dGhcIjtcclxuaW1wb3J0IHsganNvblJlc3BvbnNlIH0gZnJvbSBcIi4vaHR0cC1yZXNwb25zZVwiO1xyXG5cclxuY29uc3QgY2xpZW50ID0gbmV3IENvZ25pdG9JZGVudGl0eVByb3ZpZGVyQ2xpZW50KHt9KTtcclxuXHJcbmV4cG9ydCBjb25zdCBoYW5kbGVyID0gYXN5bmMgKFxyXG4gIGV2ZW50OiBBUElHYXRld2F5UHJveHlFdmVudFxyXG4pOiBQcm9taXNlPEFQSUdhdGV3YXlQcm94eVJlc3VsdD4gPT4ge1xyXG4gIHRyeSB7XHJcbiAgICBpZiAoZXZlbnQuaHR0cE1ldGhvZCA9PT0gXCJPUFRJT05TXCIpIHtcclxuICAgICAgcmV0dXJuIGpzb25SZXNwb25zZSgyMDAsIHt9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWlzQWRtaW4oZXZlbnQpKSB7XHJcbiAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoNDAzLCB7XHJcbiAgICAgICAgbWVzc2FnZTogXCJBY2Nlc3MgZGVuaWVkLiBBZG1pbiByb2xlIHJlcXVpcmVkLlwiLFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB1c2VySWQgPSBldmVudC5wYXRoUGFyYW1ldGVycz8udXNlcklkO1xyXG4gICAgaWYgKCF1c2VySWQpIHtcclxuICAgICAgcmV0dXJuIGpzb25SZXNwb25zZSg0MDAsIHsgbWVzc2FnZTogXCJVc2VyIElEIGlzIHJlcXVpcmVkXCIgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IHVzZXJEYXRhOiBhbnkgPSB7fTtcclxuICAgIHRyeSB7XHJcbiAgICAgIHVzZXJEYXRhID0gZXZlbnQuYm9keSA/IEpTT04ucGFyc2UoZXZlbnQuYm9keSkgOiB7fTtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICByZXR1cm4ganNvblJlc3BvbnNlKDQwMCwgeyBtZXNzYWdlOiBcIkludmFsaWQgSlNPTiBib2R5XCIgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZW1haWwgPSB1c2VyRGF0YT8uZW1haWw7XHJcbiAgICBpZiAoIWVtYWlsKSB7XHJcbiAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoNDAwLCB7IG1lc3NhZ2U6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBpbnB1dCA9IHtcclxuICAgICAgVXNlclBvb2xJZDogcHJvY2Vzcy5lbnYuVVNFUl9QT09MX0lELFxyXG4gICAgICBVc2VybmFtZTogdXNlcklkLFxyXG4gICAgICBVc2VyQXR0cmlidXRlczogW1xyXG4gICAgICAgIHsgTmFtZTogXCJlbWFpbFwiLCBWYWx1ZTogU3RyaW5nKGVtYWlsKSB9LFxyXG4gICAgICAgIHsgTmFtZTogXCJlbWFpbF92ZXJpZmllZFwiLCBWYWx1ZTogXCJ0cnVlXCIgfSxcclxuICAgICAgXSxcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBBZG1pblVwZGF0ZVVzZXJBdHRyaWJ1dGVzQ29tbWFuZChpbnB1dCk7XHJcbiAgICBhd2FpdCBjbGllbnQuc2VuZChjb21tYW5kKTtcclxuXHJcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKDIwMCwge1xyXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgdXBkYXRlZCBzdWNjZXNzZnVsbHlcIixcclxuICAgICAgdXNlcklkLFxyXG4gICAgICBlbWFpbCxcclxuICAgIH0pO1xyXG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciB1cGRhdGluZyB1c2VyOlwiLCBlcnJvcik7XHJcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKDUwMCwgeyBtZXNzYWdlOiBcIkZhaWxlZCB0byB1cGRhdGUgdXNlclwiIH0pO1xyXG4gIH1cclxufTtcclxuIl19