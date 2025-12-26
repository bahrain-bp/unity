"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const auth_helper_1 = require("./auth-helper");
const client = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({});
const handler = async (event) => {
    try {
        if (!(0, auth_helper_1.isAdmin)(event)) {
            return {
                statusCode: 403,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "Access denied. Not an Admin." }),
            };
        }
        // List all users from Cognito
        const command = new client_cognito_identity_provider_1.ListUsersCommand({
            UserPoolId: process.env.USER_POOL_ID,
        });
        const result = await client.send(command);
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ users: result.Users || [] }),
        };
    }
    catch (error) {
        console.error("Error getting users:", error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: "Failed to get users" }),
        };
    }
};
exports.handler = handler;
