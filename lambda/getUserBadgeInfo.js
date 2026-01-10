"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const dynamo = new client_dynamodb_1.DynamoDBClient({});
const s3 = new client_s3_1.S3Client({});
const handler = async (event) => {
    try {
        const body = event.body && event.body !== "null"
            ? JSON.parse(event.body)
            : {};
        const { userId, passedRegistration } = body;
        if (!userId) {
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ message: "Missing userId" }),
            };
        }
        //  If passedRegistration is provided → UPDATE
        if (typeof passedRegistration === "boolean") {
            await dynamo.send(new client_dynamodb_1.UpdateItemCommand({
                TableName: process.env.USER_TABLE,
                Key: {
                    userId: { S: userId },
                },
                UpdateExpression: "SET passedRegistration = :p, updatedAt = :u",
                ExpressionAttributeValues: {
                    ":p": { BOOL: passedRegistration },
                    ":u": { S: new Date().toISOString() },
                },
                ConditionExpression: "attribute_exists(userId)",
            }));
        }
        // READ updated user
        const result = await dynamo.send(new client_dynamodb_1.GetItemCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                userId: { S: userId },
            },
            ConsistentRead: true,
        }));
        if (!result.Item) {
            return {
                statusCode: 404,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ message: "User not found" }),
            };
        }
        const userName = result.Item.name?.S ?? "";
        const s3Key = result.Item.s3Key?.S;
        const finalPassedRegistration = result.Item.passedRegistration?.BOOL ?? false;
        if (!s3Key) {
            return {
                statusCode: 404,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ message: "Image not found" }),
            };
        }
        //  Generate presigned URL
        const command = new client_s3_1.GetObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: s3Key,
        });
        const imageUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3, command, {
            expiresIn: 300,
        });
        // Return badge info
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                userId,
                userName,
                imageUrl,
                passedRegistration: finalPassedRegistration,
            }),
        };
    }
    catch (error) {
        console.error("GetUserBadgeInfo error", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: "Internal server error" }),
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0VXNlckJhZGdlSW5mby5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImdldFVzZXJCYWRnZUluZm8udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsOERBSWtDO0FBQ2xDLGtEQUc0QjtBQUM1Qix3RUFBNkQ7QUFFN0QsTUFBTSxNQUFNLEdBQUcsSUFBSSxnQ0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3RDLE1BQU0sRUFBRSxHQUFHLElBQUksb0JBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUVyQixNQUFNLE9BQU8sR0FBRyxLQUFLLEVBQUUsS0FBVSxFQUFFLEVBQUU7SUFDMUMsSUFBSSxDQUFDO1FBQ1AsTUFBTSxJQUFJLEdBQ1IsS0FBSyxDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU07WUFDakMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUN4QixDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ0wsTUFBTSxFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxHQUFHLElBQUksQ0FBQztRQUU1QyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDbEIsT0FBTztnQkFDTCxVQUFVLEVBQUUsR0FBRztnQkFDZixPQUFPLEVBQUU7b0JBQ1AsNkJBQTZCLEVBQUUsR0FBRztvQkFDbEMsY0FBYyxFQUFFLGtCQUFrQjtpQkFDbkM7Z0JBQ0QsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsQ0FBQzthQUNwRCxDQUFDO1FBRUUsQ0FBQztRQUVELDhDQUE4QztRQUM5QyxJQUFJLE9BQU8sa0JBQWtCLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDNUMsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUNmLElBQUksbUNBQWlCLENBQUM7Z0JBQ3BCLFNBQVMsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVc7Z0JBQ2xDLEdBQUcs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QUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsQ0FBQztTQUMzRCxDQUFDO0lBQ0osQ0FBQztBQUNILENBQUMsQ0FBQztBQWhIVyxRQUFBLE9BQU8sV0FnSGxCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcclxuICBEeW5hbW9EQkNsaWVudCxcclxuICBHZXRJdGVtQ29tbWFuZCxcclxuICBVcGRhdGVJdGVtQ29tbWFuZCxcclxufSBmcm9tIFwiQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiXCI7XHJcbmltcG9ydCB7XHJcbiAgUzNDbGllbnQsXHJcbiAgR2V0T2JqZWN0Q29tbWFuZCxcclxufSBmcm9tIFwiQGF3cy1zZGsvY2xpZW50LXMzXCI7XHJcbmltcG9ydCB7IGdldFNpZ25lZFVybCB9IGZyb20gXCJAYXdzLXNkay9zMy1yZXF1ZXN0LXByZXNpZ25lclwiO1xyXG5cclxuY29uc3QgZHluYW1vID0gbmV3IER5bmFtb0RCQ2xpZW50KHt9KTtcclxuY29uc3QgczMgPSBuZXcgUzNDbGllbnQoe30pO1xyXG5cclxuZXhwb3J0IGNvbnN0IGhhbmRsZXIgPSBhc3luYyAoZXZlbnQ6IGFueSkgPT4ge1xyXG4gIHRyeSB7XHJcbmNvbnN0IGJvZHkgPVxyXG4gIGV2ZW50LmJvZHkgJiYgZXZlbnQuYm9keSAhPT0gXCJudWxsXCJcclxuICAgID8gSlNPTi5wYXJzZShldmVudC5ib2R5KVxyXG4gICAgOiB7fTtcclxuICAgIGNvbnN0IHsgdXNlcklkLCBwYXNzZWRSZWdpc3RyYXRpb24gfSA9IGJvZHk7XHJcblxyXG4gICAgaWYgKCF1c2VySWQpIHtcclxucmV0dXJuIHtcclxuICBzdGF0dXNDb2RlOiA0MDAsXHJcbiAgaGVhZGVyczoge1xyXG4gICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogXCIqXCIsXHJcbiAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcclxuICB9LFxyXG4gIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgbWVzc2FnZTogXCJNaXNzaW5nIHVzZXJJZFwiIH0pLFxyXG59O1xyXG5cclxuICAgIH1cclxuXHJcbiAgICAvLyAgSWYgcGFzc2VkUmVnaXN0cmF0aW9uIGlzIHByb3ZpZGVkIOKGkiBVUERBVEVcclxuICAgIGlmICh0eXBlb2YgcGFzc2VkUmVnaXN0cmF0aW9uID09PSBcImJvb2xlYW5cIikge1xyXG4gICAgICBhd2FpdCBkeW5hbW8uc2VuZChcclxuICAgICAgICBuZXcgVXBkYXRlSXRlbUNvbW1hbmQoe1xyXG4gICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5VU0VSX1RBQkxFISxcclxuICAgICAgICAgIEtleToge1xyXG4gICAgICAgICAgICB1c2VySWQ6IHsgUzogdXNlcklkIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBVcGRhdGVFeHByZXNzaW9uOiBcIlNFVCBwYXNzZWRSZWdpc3RyYXRpb24gPSA6cCwgdXBkYXRlZEF0ID0gOnVcIixcclxuICAgICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xyXG4gICAgICAgICAgICBcIjpwXCI6IHsgQk9PTDogcGFzc2VkUmVnaXN0cmF0aW9uIH0sXHJcbiAgICAgICAgICAgIFwiOnVcIjogeyBTOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkgfSxcclxuICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICBDb25kaXRpb25FeHByZXNzaW9uOiBcImF0dHJpYnV0ZV9leGlzdHModXNlcklkKVwiLFxyXG4gICAgICAgIH0pXHJcbiAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUkVBRCB1cGRhdGVkIHVzZXJcclxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGR5bmFtby5zZW5kKFxyXG4gICAgICBuZXcgR2V0SXRlbUNvbW1hbmQoe1xyXG4gICAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuVVNFUl9UQUJMRSEsXHJcbiAgICAgICAgS2V5OiB7XHJcbiAgICAgICAgICB1c2VySWQ6IHsgUzogdXNlcklkIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgICBDb25zaXN0ZW50UmVhZDogdHJ1ZSxcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gICAgaWYgKCFyZXN1bHQuSXRlbSkge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIHN0YXR1c0NvZGU6IDQwNCxcclxuICBoZWFkZXJzOiB7XHJcbiAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiBcIipcIixcclxuICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxyXG4gIH0sXHJcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBtZXNzYWdlOiBcIlVzZXIgbm90IGZvdW5kXCIgfSksXHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgdXNlck5hbWUgPSByZXN1bHQuSXRlbS5uYW1lPy5TID8/IFwiXCI7XHJcbiAgICBjb25zdCBzM0tleSA9IHJlc3VsdC5JdGVtLnMzS2V5Py5TO1xyXG4gICAgY29uc3QgZmluYWxQYXNzZWRSZWdpc3RyYXRpb24gPVxyXG4gICAgICByZXN1bHQuSXRlbS5wYXNzZWRSZWdpc3RyYXRpb24/LkJPT0wgPz8gZmFsc2U7XHJcblxyXG4gICAgaWYgKCFzM0tleSkge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIHN0YXR1c0NvZGU6IDQwNCxcclxuICBoZWFkZXJzOiB7XHJcbiAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiBcIipcIixcclxuICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxyXG4gIH0sXHJcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBtZXNzYWdlOiBcIkltYWdlIG5vdCBmb3VuZFwiIH0pLFxyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIC8vICBHZW5lcmF0ZSBwcmVzaWduZWQgVVJMXHJcbiAgICBjb25zdCBjb21tYW5kID0gbmV3IEdldE9iamVjdENvbW1hbmQoe1xyXG4gICAgICBCdWNrZXQ6IHByb2Nlc3MuZW52LkJVQ0tFVF9OQU1FISxcclxuICAgICAgS2V5OiBzM0tleSxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGltYWdlVXJsID0gYXdhaXQgZ2V0U2lnbmVkVXJsKHMzLCBjb21tYW5kLCB7XHJcbiAgICAgIGV4cGlyZXNJbjogMzAwLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gUmV0dXJuIGJhZGdlIGluZm9cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHN0YXR1c0NvZGU6IDIwMCxcclxuICBoZWFkZXJzOiB7XHJcbiAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiBcIipcIixcclxuICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxyXG4gIH0sXHJcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICB1c2VySWQsXHJcbiAgICAgICAgdXNlck5hbWUsXHJcbiAgICAgICAgaW1hZ2VVcmwsXHJcbiAgICAgICAgcGFzc2VkUmVnaXN0cmF0aW9uOiBmaW5hbFBhc3NlZFJlZ2lzdHJhdGlvbixcclxuICAgICAgfSksXHJcbiAgICB9O1xyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICBjb25zb2xlLmVycm9yKFwiR2V0VXNlckJhZGdlSW5mbyBlcnJvclwiLCBlcnJvcik7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzdGF0dXNDb2RlOiA1MDAsXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiBcIipcIixcclxuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcclxuICAgICAgfSxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBtZXNzYWdlOiBcIkludGVybmFsIHNlcnZlciBlcnJvclwiIH0pLFxyXG4gICAgfTtcclxuICB9XHJcbn07XHJcbiJdfQ==