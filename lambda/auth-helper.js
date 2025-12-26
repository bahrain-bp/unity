"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = void 0;
const isAdmin = (event) => {
    const userGroups = event.requestContext.authorizer?.claims?.["cognito:groups"];
    if (!userGroups)
        return false;
    const groups = Array.isArray(userGroups)
        ? userGroups
        : String(userGroups).split(",");
    return groups.includes("admin");
};
exports.isAdmin = isAdmin;
