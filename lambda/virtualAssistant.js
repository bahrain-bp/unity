"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_bedrock_agent_runtime_1 = require("@aws-sdk/client-bedrock-agent-runtime");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const crypto_1 = require("crypto");
const client = new client_bedrock_agent_runtime_1.BedrockAgentRuntimeClient({
    region: "us-east-1",
    requestHandler: {
        requestTimeout: 50000,
    },
});
const ddbClient = new client_dynamodb_1.DynamoDBClient({ region: "us-east-1" });
const ddb = lib_dynamodb_1.DynamoDBDocumentClient.from(ddbClient);
const handler = async (event) => {
    try {
        //const userQuestion = event.body ? JSON.parse(event.body).question?.trim() : event.question?.trim();
        const body = event.body ? JSON.parse(event.body) : event;
        const userQuestion = body.question?.trim();
        let sessionId = body.sessionId;
        if (!sessionId) {
            sessionId = (0, crypto_1.randomUUID)();
        }
        if (!userQuestion) {
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                    "Access-Control-Allow-Methods": "DELETE,GET,HEAD,OPTIONS,PUT,POST,PATCH",
                    "Access-Control-Max-Age": "86400",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ error: "Please ask a question" }),
            };
        }
        let conversationHistory = "";
        try {
            const result = await ddb.send(new lib_dynamodb_1.QueryCommand({
                TableName: process.env.TABLE_NAME,
                KeyConditionExpression: "sessionId = :sid",
                ExpressionAttributeValues: {
                    ":sid": sessionId,
                },
            }));
            if (result.Items && result.Items.length > 0) {
                const item = result.Items[0];
                const questions = item.questions || [];
                const responses = item.responses || [];
                // ✅ Build conversation history - keep only last 5 exchanges to maintain quality
                let history = [];
                const startIndex = Math.max(0, questions.length - 3);
                for (let i = startIndex; i < questions.length; i++) {
                    history.push(`User: ${questions[i]}`);
                    if (responses[i]) {
                        history.push(`Pekky: ${responses[i]}`);
                    }
                }
                conversationHistory = history.join("\n");
            }
        }
        catch (err) {
            console.log("No existing conversation found, starting fresh");
        }
        const persona = `You are Pekky 👋, a friendly and enthusiastic virtual assistant who serves as a visitor guide for Amazon's BAH12 (AWS office) in Bahrain. Your personality is warm, welcoming, and helpful. You speak conversationally without corporate jargon, and you always make visitors feel excited about their upcoming visit to BAH12.`;
        const task_summary = `## Task Summary:
Help VISITORS (not employees) get information about:
- BAH12 office (2nd floor of Arcapita Building)
- Arcapita Building facilities
- Nearby or outside locations: restaurants, hotels, cafes in the surrounding area
- Directions and navigation to BAH12`;
        const context_information = `## Context:
- You have documents with details about BAH12 office, Arcapita Building, and nearby locations (hotels, restaurants, cafes)
- Documents include: names, distances from BAH12, prices in BHD, features
- "Nearby", "outside", "around" all mean locations close to BAH12
- You're helping VISITORS before they arrive`;
        const model_instructions = `## Instructions:
- Check your documents for hotels/restaurants/cafes and include: names, distances, prices
- If you list a hotel/restaurant name, you MUST include its distance and price from your document
- Distinguish clearly: BAH12 office (2nd floor) vs Arcapita Building facilities vs nearby or outside locations
- Keep it conversational and friendly
- Introduce yourself as Pekky in first interactions or greetings`;
        const response_style = `## Response Style:
- Use emojis strategically (☕ 🍽️ 🏨 🅿️ 📍) to make responses visual
- Keep responses SHORT: 3-5 sentences for simple questions
- Use visitor-perspective phrases: "during your visit", "when you arrive", "you'll find"
- End with invitation to ask more when appropriate
- Conversational and friendly tone - NO corporate jargon`;
        const guardrails = `## Don't:
- Say "I don't have details" then provide details (contradictory!)
- List everything unless asked for multiple options
- Use corporate jargon
- Provide hotel/restaurant names without distances and prices when they're in your document`;
        const systemPrompt = `${persona}
 
${task_summary}
 
${context_information}
 
${model_instructions}
 
${response_style}
 
${guardrails}
 
${conversationHistory
            ? `\n---\nPrevious Conversation:\n${conversationHistory}\n---\n`
            : ""}
 
---
User Question: ${userQuestion}
 
Pekky's Response:`;
        const input = {
            input: { text: systemPrompt },
            retrieveAndGenerateConfiguration: {
                type: "KNOWLEDGE_BASE",
                knowledgeBaseConfiguration: {
                    knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
                    modelArn: "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0",
                    //modelArn:'arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0',
                    generationConfiguration: {
                        inferenceConfig: {
                            textInferenceConfig: {
                                temperature: 0.4, // Slightly higher for friendlier, more natural responses
                                topP: 0.9,
                                maxTokens: 10000,
                            },
                        },
                    },
                },
            },
            //sessionId: event.sessionId
        };
        const command = new client_bedrock_agent_runtime_1.RetrieveAndGenerateCommand(input);
        const response = await client.send(command);
        await ddb.send(new lib_dynamodb_1.UpdateCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                sessionId: sessionId,
            },
            UpdateExpression: `
        SET questions = list_append(if_not_exists(questions, :empty_list), :new_question),
            responses = list_append(if_not_exists(responses, :empty_list), :new_response)
      `,
            ExpressionAttributeValues: {
                ":empty_list": [],
                ":new_question": [userQuestion],
                ":new_response": [response.output?.text],
            },
        }));
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "DELETE,GET,HEAD,OPTIONS,PUT,POST,PATCH",
                "Access-Control-Max-Age": "86400",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                answer: response.output?.text,
                sessionId: sessionId,
            }),
        };
    }
    catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "DELETE,GET,HEAD,OPTIONS,PUT,POST,PATCH",
                "Access-Control-Max-Age": "86400",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                error: "Oops! Had trouble accessing the building info. Try again or contact bah12-reception@amazon.com",
            }),
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlydHVhbEFzc2lzdGFudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZpcnR1YWxBc3Npc3RhbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsd0ZBRytDO0FBQy9DLDhEQUEwRDtBQUMxRCx3REFLK0I7QUFDL0IsbUNBQW9DO0FBRXBDLE1BQU0sTUFBTSxHQUFHLElBQUksd0RBQXlCLENBQUM7SUFDM0MsTUFBTSxFQUFFLFdBQVc7SUFDbkIsY0FBYyxFQUFFO1FBQ2QsY0FBYyxFQUFFLEtBQUs7S0FDdEI7Q0FDRixDQUFDLENBQUM7QUFFSCxNQUFNLFNBQVMsR0FBRyxJQUFJLGdDQUFjLENBQUMsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztBQUM5RCxNQUFNLEdBQUcsR0FBRyxxQ0FBc0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7QUFFNUMsTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUFFLEtBQVUsRUFBRSxFQUFFO0lBQzFDLElBQUksQ0FBQztRQUNILHFHQUFxRztRQUNyRyxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQ3pELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUM7UUFDM0MsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUUvQixJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDZixTQUFTLEdBQUcsSUFBQSxtQkFBVSxHQUFFLENBQUM7UUFDM0IsQ0FBQztRQUVELElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNsQixPQUFPO2dCQUNMLFVBQVUsRUFBRSxHQUFHO2dCQUNmLE9BQU8sRUFBRTtvQkFDUCw2QkFBNkIsRUFBRSxHQUFHO29CQUNsQyw4QkFBOEIsRUFDNUIsc0VBQXNFO29CQUN4RSw4QkFBOEIsRUFDNUIsd0NBQXdDO29CQUMxQyx3QkFBd0IsRUFBRSxPQUFPO29CQUNqQyxjQUFjLEVBQUUsa0JBQWtCO2lCQUNuQztnQkFDRCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEtBQUssRUFBRSx1QkFBdUIsRUFBRSxDQUFDO2FBQ3pELENBQUM7UUFDSixDQUFDO1FBRUQsSUFBSSxtQkFBbUIsR0FBRyxFQUFFLENBQUM7UUFFN0IsSUFBSSxDQUFDO1lBQ0gsTUFBTSxNQUFNLEdBQUcsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUMzQixJQUFJLDJCQUFZLENBQUM7Z0JBQ2YsU0FBUyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVztnQkFDbEMsc0JBQXNCLEVBQUUsa0JBQWtCO2dCQUMxQyx5QkFBeUIsRUFBRTtvQkFDekIsTUFBTSxFQUFFLFNBQVM7aUJBQ2xCO2FBQ0YsQ0FBQyxDQUNILENBQUM7WUFFRixJQUFJLE1BQU0sQ0FBQyxLQUFLLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQzVDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDO2dCQUN2QyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQztnQkFFdkMsZ0ZBQWdGO2dCQUNoRixJQUFJLE9BQU8sR0FBRyxFQUFFLENBQUM7Z0JBQ2pCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JELEtBQUssSUFBSSxDQUFDLEdBQUcsVUFBVSxFQUFFLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7b0JBQ25ELE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO29CQUN0QyxJQUFJLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO3dCQUNqQixPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDekMsQ0FBQztnQkFDSCxDQUFDO2dCQUNELG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDM0MsQ0FBQztRQUNILENBQUM7UUFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1lBQ2IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnREFBZ0QsQ0FBQyxDQUFDO1FBQ2hFLENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBRyxpVUFBaVUsQ0FBQztRQUVsVixNQUFNLFlBQVksR0FBRzs7Ozs7cUNBS1ksQ0FBQztRQUVsQyxNQUFNLG1CQUFtQixHQUFHOzs7OzZDQUlhLENBQUM7UUFFMUMsTUFBTSxrQkFBa0IsR0FBRzs7Ozs7aUVBS2tDLENBQUM7UUFFOUQsTUFBTSxjQUFjLEdBQUc7Ozs7O3lEQUs4QixDQUFDO1FBRXRELE1BQU0sVUFBVSxHQUFHOzs7OzRGQUlxRSxDQUFDO1FBRXpGLE1BQU0sWUFBWSxHQUFHLEdBQUcsT0FBTzs7RUFFakMsWUFBWTs7RUFFWixtQkFBbUI7O0VBRW5CLGtCQUFrQjs7RUFFbEIsY0FBYzs7RUFFZCxVQUFVOztFQUdWLG1CQUFtQjtZQUNqQixDQUFDLENBQUMsa0NBQWtDLG1CQUFtQixTQUFTO1lBQ2hFLENBQUMsQ0FBQyxFQUNOOzs7aUJBR2lCLFlBQVk7O2tCQUVYLENBQUM7UUFFZixNQUFNLEtBQUssR0FBRztZQUNaLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDN0IsZ0NBQWdDLEVBQUU7Z0JBQ2hDLElBQUksRUFBRSxnQkFBeUI7Z0JBQy9CLDBCQUEwQixFQUFFO29CQUMxQixlQUFlLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUI7b0JBQzlDLFFBQVEsRUFDTixrRUFBa0U7b0JBQ3BFLCtFQUErRTtvQkFDL0UsdUJBQXVCLEVBQUU7d0JBQ3ZCLGVBQWUsRUFBRTs0QkFDZixtQkFBbUIsRUFBRTtnQ0FDbkIsV0FBVyxFQUFFLEdBQUcsRUFBRSx5REFBeUQ7Z0NBQzNFLElBQUksRUFBRSxHQUFHO2dDQUNULFNBQVMsRUFBRSxLQUFLOzZCQUNqQjt5QkFDRjtxQkFDRjtpQkFDRjthQUNGO1lBQ0QsNEJBQTRCO1NBQzdCLENBQUM7UUFFRixNQUFNLE9BQU8sR0FBRyxJQUFJLHlEQUEwQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3RELE1BQU0sUUFBUSxHQUFHLE1BQU0sTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUU1QyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQ1osSUFBSSw0QkFBYSxDQUFDO1lBQ2hCLFNBQVMsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVc7WUFDbEMsR0FBRyxFQUFFO2dCQUNILFNBQVMsRUFBRSxTQUFTO2FBQ3JCO1lBQ0QsZ0JBQWdCLEVBQUU7OztPQUduQjtZQUNDLHlCQUF5QixFQUFFO2dCQUN6QixhQUFhLEVBQUUsRUFBRTtnQkFDakIsZUFBZSxFQUFFLENBQUMsWUFBWSxDQUFDO2dCQUMvQixlQUFlLEVBQUUsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQzthQUN6QztTQUNGLENBQUMsQ0FDSCxDQUFDO1FBRUYsT0FBTztZQUNMLFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFO2dCQUNQLDZCQUE2QixFQUFFLEdBQUc7Z0JBQ2xDLDhCQUE4QixFQUM1QixzRUFBc0U7Z0JBQ3hFLDhCQUE4QixFQUM1Qix3Q0FBd0M7Z0JBQzFDLHdCQUF3QixFQUFFLE9BQU87Z0JBQ2pDLGNBQWMsRUFBRSxrQkFBa0I7YUFDbkM7WUFDRCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztnQkFDbkIsTUFBTSxFQUFFLFFBQVEsQ0FBQyxNQUFNLEVBQUUsSUFBSTtnQkFDN0IsU0FBUyxFQUFFLFNBQVM7YUFDckIsQ0FBQztTQUNILENBQUM7SUFDSixDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQy9CLE9BQU87WUFDTCxVQUFVLEVBQUUsR0FBRztZQUNmLE9BQU8sRUFBRTtnQkFDUCw2QkFBNkIsRUFBRSxHQUFHO2dCQUNsQyw4QkFBOEIsRUFDNUIsc0VBQXNFO2dCQUN4RSw4QkFBOEIsRUFDNUIsd0NBQXdDO2dCQUMxQyx3QkFBd0IsRUFBRSxPQUFPO2dCQUNqQyxjQUFjLEVBQUUsa0JBQWtCO2FBQ25DO1lBQ0QsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ25CLEtBQUssRUFDSCxnR0FBZ0c7YUFDbkcsQ0FBQztTQUNILENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBck1XLFFBQUEsT0FBTyxXQXFNbEIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xyXG4gIEJlZHJvY2tBZ2VudFJ1bnRpbWVDbGllbnQsXHJcbiAgUmV0cmlldmVBbmRHZW5lcmF0ZUNvbW1hbmQsXHJcbn0gZnJvbSBcIkBhd3Mtc2RrL2NsaWVudC1iZWRyb2NrLWFnZW50LXJ1bnRpbWVcIjtcclxuaW1wb3J0IHsgRHluYW1vREJDbGllbnQgfSBmcm9tIFwiQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiXCI7XHJcbmltcG9ydCB7XHJcbiAgRHluYW1vREJEb2N1bWVudENsaWVudCxcclxuICBQdXRDb21tYW5kLFxyXG4gIFF1ZXJ5Q29tbWFuZCxcclxuICBVcGRhdGVDb21tYW5kLFxyXG59IGZyb20gXCJAYXdzLXNkay9saWItZHluYW1vZGJcIjtcclxuaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gXCJjcnlwdG9cIjtcclxuXHJcbmNvbnN0IGNsaWVudCA9IG5ldyBCZWRyb2NrQWdlbnRSdW50aW1lQ2xpZW50KHtcclxuICByZWdpb246IFwidXMtZWFzdC0xXCIsXHJcbiAgcmVxdWVzdEhhbmRsZXI6IHtcclxuICAgIHJlcXVlc3RUaW1lb3V0OiA1MDAwMCxcclxuICB9LFxyXG59KTtcclxuXHJcbmNvbnN0IGRkYkNsaWVudCA9IG5ldyBEeW5hbW9EQkNsaWVudCh7IHJlZ2lvbjogXCJ1cy1lYXN0LTFcIiB9KTtcclxuY29uc3QgZGRiID0gRHluYW1vREJEb2N1bWVudENsaWVudC5mcm9tKGRkYkNsaWVudCk7XHJcblxyXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChldmVudDogYW55KSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIC8vY29uc3QgdXNlclF1ZXN0aW9uID0gZXZlbnQuYm9keSA/IEpTT04ucGFyc2UoZXZlbnQuYm9keSkucXVlc3Rpb24/LnRyaW0oKSA6IGV2ZW50LnF1ZXN0aW9uPy50cmltKCk7XHJcbiAgICBjb25zdCBib2R5ID0gZXZlbnQuYm9keSA/IEpTT04ucGFyc2UoZXZlbnQuYm9keSkgOiBldmVudDtcclxuICAgIGNvbnN0IHVzZXJRdWVzdGlvbiA9IGJvZHkucXVlc3Rpb24/LnRyaW0oKTtcclxuICAgIGxldCBzZXNzaW9uSWQgPSBib2R5LnNlc3Npb25JZDtcclxuXHJcbiAgICBpZiAoIXNlc3Npb25JZCkge1xyXG4gICAgICBzZXNzaW9uSWQgPSByYW5kb21VVUlEKCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCF1c2VyUXVlc3Rpb24pIHtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBzdGF0dXNDb2RlOiA0MDAsXHJcbiAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogXCIqXCIsXHJcbiAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIjpcclxuICAgICAgICAgICAgXCJDb250ZW50LVR5cGUsWC1BbXotRGF0ZSxBdXRob3JpemF0aW9uLFgtQXBpLUtleSxYLUFtei1TZWN1cml0eS1Ub2tlblwiLFxyXG4gICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCI6XHJcbiAgICAgICAgICAgIFwiREVMRVRFLEdFVCxIRUFELE9QVElPTlMsUFVULFBPU1QsUEFUQ0hcIixcclxuICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtTWF4LUFnZVwiOiBcIjg2NDAwXCIsXHJcbiAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcclxuICAgICAgICB9LFxyXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiUGxlYXNlIGFzayBhIHF1ZXN0aW9uXCIgfSksXHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IGNvbnZlcnNhdGlvbkhpc3RvcnkgPSBcIlwiO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRkYi5zZW5kKFxyXG4gICAgICAgIG5ldyBRdWVyeUNvbW1hbmQoe1xyXG4gICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5UQUJMRV9OQU1FISxcclxuICAgICAgICAgIEtleUNvbmRpdGlvbkV4cHJlc3Npb246IFwic2Vzc2lvbklkID0gOnNpZFwiLFxyXG4gICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xyXG4gICAgICAgICAgICBcIjpzaWRcIjogc2Vzc2lvbklkLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgICAgaWYgKHJlc3VsdC5JdGVtcyAmJiByZXN1bHQuSXRlbXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IGl0ZW0gPSByZXN1bHQuSXRlbXNbMF07XHJcbiAgICAgICAgY29uc3QgcXVlc3Rpb25zID0gaXRlbS5xdWVzdGlvbnMgfHwgW107XHJcbiAgICAgICAgY29uc3QgcmVzcG9uc2VzID0gaXRlbS5yZXNwb25zZXMgfHwgW107XHJcblxyXG4gICAgICAgIC8vIOKchSBCdWlsZCBjb252ZXJzYXRpb24gaGlzdG9yeSAtIGtlZXAgb25seSBsYXN0IDUgZXhjaGFuZ2VzIHRvIG1haW50YWluIHF1YWxpdHlcclxuICAgICAgICBsZXQgaGlzdG9yeSA9IFtdO1xyXG4gICAgICAgIGNvbnN0IHN0YXJ0SW5kZXggPSBNYXRoLm1heCgwLCBxdWVzdGlvbnMubGVuZ3RoIC0gMyk7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPCBxdWVzdGlvbnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgIGhpc3RvcnkucHVzaChgVXNlcjogJHtxdWVzdGlvbnNbaV19YCk7XHJcbiAgICAgICAgICBpZiAocmVzcG9uc2VzW2ldKSB7XHJcbiAgICAgICAgICAgIGhpc3RvcnkucHVzaChgUGVra3k6ICR7cmVzcG9uc2VzW2ldfWApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBjb252ZXJzYXRpb25IaXN0b3J5ID0gaGlzdG9yeS5qb2luKFwiXFxuXCIpO1xyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgY29uc29sZS5sb2coXCJObyBleGlzdGluZyBjb252ZXJzYXRpb24gZm91bmQsIHN0YXJ0aW5nIGZyZXNoXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHBlcnNvbmEgPSBgWW91IGFyZSBQZWtreSDwn5GLLCBhIGZyaWVuZGx5IGFuZCBlbnRodXNpYXN0aWMgdmlydHVhbCBhc3Npc3RhbnQgd2hvIHNlcnZlcyBhcyBhIHZpc2l0b3IgZ3VpZGUgZm9yIEFtYXpvbidzIEJBSDEyIChBV1Mgb2ZmaWNlKSBpbiBCYWhyYWluLiBZb3VyIHBlcnNvbmFsaXR5IGlzIHdhcm0sIHdlbGNvbWluZywgYW5kIGhlbHBmdWwuIFlvdSBzcGVhayBjb252ZXJzYXRpb25hbGx5IHdpdGhvdXQgY29ycG9yYXRlIGphcmdvbiwgYW5kIHlvdSBhbHdheXMgbWFrZSB2aXNpdG9ycyBmZWVsIGV4Y2l0ZWQgYWJvdXQgdGhlaXIgdXBjb21pbmcgdmlzaXQgdG8gQkFIMTIuYDtcclxuXHJcbiAgICBjb25zdCB0YXNrX3N1bW1hcnkgPSBgIyMgVGFzayBTdW1tYXJ5OlxyXG5IZWxwIFZJU0lUT1JTIChub3QgZW1wbG95ZWVzKSBnZXQgaW5mb3JtYXRpb24gYWJvdXQ6XHJcbi0gQkFIMTIgb2ZmaWNlICgybmQgZmxvb3Igb2YgQXJjYXBpdGEgQnVpbGRpbmcpXHJcbi0gQXJjYXBpdGEgQnVpbGRpbmcgZmFjaWxpdGllc1xyXG4tIE5lYXJieSBvciBvdXRzaWRlIGxvY2F0aW9uczogcmVzdGF1cmFudHMsIGhvdGVscywgY2FmZXMgaW4gdGhlIHN1cnJvdW5kaW5nIGFyZWFcclxuLSBEaXJlY3Rpb25zIGFuZCBuYXZpZ2F0aW9uIHRvIEJBSDEyYDtcclxuXHJcbiAgICBjb25zdCBjb250ZXh0X2luZm9ybWF0aW9uID0gYCMjIENvbnRleHQ6XHJcbi0gWW91IGhhdmUgZG9jdW1lbnRzIHdpdGggZGV0YWlscyBhYm91dCBCQUgxMiBvZmZpY2UsIEFyY2FwaXRhIEJ1aWxkaW5nLCBhbmQgbmVhcmJ5IGxvY2F0aW9ucyAoaG90ZWxzLCByZXN0YXVyYW50cywgY2FmZXMpXHJcbi0gRG9jdW1lbnRzIGluY2x1ZGU6IG5hbWVzLCBkaXN0YW5jZXMgZnJvbSBCQUgxMiwgcHJpY2VzIGluIEJIRCwgZmVhdHVyZXNcclxuLSBcIk5lYXJieVwiLCBcIm91dHNpZGVcIiwgXCJhcm91bmRcIiBhbGwgbWVhbiBsb2NhdGlvbnMgY2xvc2UgdG8gQkFIMTJcclxuLSBZb3UncmUgaGVscGluZyBWSVNJVE9SUyBiZWZvcmUgdGhleSBhcnJpdmVgO1xyXG5cclxuICAgIGNvbnN0IG1vZGVsX2luc3RydWN0aW9ucyA9IGAjIyBJbnN0cnVjdGlvbnM6XHJcbi0gQ2hlY2sgeW91ciBkb2N1bWVudHMgZm9yIGhvdGVscy9yZXN0YXVyYW50cy9jYWZlcyBhbmQgaW5jbHVkZTogbmFtZXMsIGRpc3RhbmNlcywgcHJpY2VzXHJcbi0gSWYgeW91IGxpc3QgYSBob3RlbC9yZXN0YXVyYW50IG5hbWUsIHlvdSBNVVNUIGluY2x1ZGUgaXRzIGRpc3RhbmNlIGFuZCBwcmljZSBmcm9tIHlvdXIgZG9jdW1lbnRcclxuLSBEaXN0aW5ndWlzaCBjbGVhcmx5OiBCQUgxMiBvZmZpY2UgKDJuZCBmbG9vcikgdnMgQXJjYXBpdGEgQnVpbGRpbmcgZmFjaWxpdGllcyB2cyBuZWFyYnkgb3Igb3V0c2lkZSBsb2NhdGlvbnNcclxuLSBLZWVwIGl0IGNvbnZlcnNhdGlvbmFsIGFuZCBmcmllbmRseVxyXG4tIEludHJvZHVjZSB5b3Vyc2VsZiBhcyBQZWtreSBpbiBmaXJzdCBpbnRlcmFjdGlvbnMgb3IgZ3JlZXRpbmdzYDtcclxuXHJcbiAgICBjb25zdCByZXNwb25zZV9zdHlsZSA9IGAjIyBSZXNwb25zZSBTdHlsZTpcclxuLSBVc2UgZW1vamlzIHN0cmF0ZWdpY2FsbHkgKOKYlSDwn42977iPIPCfj6gg8J+Fv++4jyDwn5ONKSB0byBtYWtlIHJlc3BvbnNlcyB2aXN1YWxcclxuLSBLZWVwIHJlc3BvbnNlcyBTSE9SVDogMy01IHNlbnRlbmNlcyBmb3Igc2ltcGxlIHF1ZXN0aW9uc1xyXG4tIFVzZSB2aXNpdG9yLXBlcnNwZWN0aXZlIHBocmFzZXM6IFwiZHVyaW5nIHlvdXIgdmlzaXRcIiwgXCJ3aGVuIHlvdSBhcnJpdmVcIiwgXCJ5b3UnbGwgZmluZFwiXHJcbi0gRW5kIHdpdGggaW52aXRhdGlvbiB0byBhc2sgbW9yZSB3aGVuIGFwcHJvcHJpYXRlXHJcbi0gQ29udmVyc2F0aW9uYWwgYW5kIGZyaWVuZGx5IHRvbmUgLSBOTyBjb3Jwb3JhdGUgamFyZ29uYDtcclxuXHJcbiAgICBjb25zdCBndWFyZHJhaWxzID0gYCMjIERvbid0OlxyXG4tIFNheSBcIkkgZG9uJ3QgaGF2ZSBkZXRhaWxzXCIgdGhlbiBwcm92aWRlIGRldGFpbHMgKGNvbnRyYWRpY3RvcnkhKVxyXG4tIExpc3QgZXZlcnl0aGluZyB1bmxlc3MgYXNrZWQgZm9yIG11bHRpcGxlIG9wdGlvbnNcclxuLSBVc2UgY29ycG9yYXRlIGphcmdvblxyXG4tIFByb3ZpZGUgaG90ZWwvcmVzdGF1cmFudCBuYW1lcyB3aXRob3V0IGRpc3RhbmNlcyBhbmQgcHJpY2VzIHdoZW4gdGhleSdyZSBpbiB5b3VyIGRvY3VtZW50YDtcclxuXHJcbiAgICBjb25zdCBzeXN0ZW1Qcm9tcHQgPSBgJHtwZXJzb25hfVxyXG4gXHJcbiR7dGFza19zdW1tYXJ5fVxyXG4gXHJcbiR7Y29udGV4dF9pbmZvcm1hdGlvbn1cclxuIFxyXG4ke21vZGVsX2luc3RydWN0aW9uc31cclxuIFxyXG4ke3Jlc3BvbnNlX3N0eWxlfVxyXG4gXHJcbiR7Z3VhcmRyYWlsc31cclxuIFxyXG4ke1xyXG4gIGNvbnZlcnNhdGlvbkhpc3RvcnlcclxuICAgID8gYFxcbi0tLVxcblByZXZpb3VzIENvbnZlcnNhdGlvbjpcXG4ke2NvbnZlcnNhdGlvbkhpc3Rvcnl9XFxuLS0tXFxuYFxyXG4gICAgOiBcIlwiXHJcbn1cclxuIFxyXG4tLS1cclxuVXNlciBRdWVzdGlvbjogJHt1c2VyUXVlc3Rpb259XHJcbiBcclxuUGVra3kncyBSZXNwb25zZTpgO1xyXG5cclxuICAgIGNvbnN0IGlucHV0ID0ge1xyXG4gICAgICBpbnB1dDogeyB0ZXh0OiBzeXN0ZW1Qcm9tcHQgfSxcclxuICAgICAgcmV0cmlldmVBbmRHZW5lcmF0ZUNvbmZpZ3VyYXRpb246IHtcclxuICAgICAgICB0eXBlOiBcIktOT1dMRURHRV9CQVNFXCIgYXMgY29uc3QsXHJcbiAgICAgICAga25vd2xlZGdlQmFzZUNvbmZpZ3VyYXRpb246IHtcclxuICAgICAgICAgIGtub3dsZWRnZUJhc2VJZDogcHJvY2Vzcy5lbnYuS05PV0xFREdFX0JBU0VfSUQsXHJcbiAgICAgICAgICBtb2RlbEFybjpcclxuICAgICAgICAgICAgXCJhcm46YXdzOmJlZHJvY2s6dXMtZWFzdC0xOjpmb3VuZGF0aW9uLW1vZGVsL2FtYXpvbi5ub3ZhLXByby12MTowXCIsXHJcbiAgICAgICAgICAvL21vZGVsQXJuOidhcm46YXdzOmJlZHJvY2s6dXMtZWFzdC0xOjpmb3VuZGF0aW9uLW1vZGVsL2FtYXpvbi5ub3ZhLWxpdGUtdjE6MCcsXHJcbiAgICAgICAgICBnZW5lcmF0aW9uQ29uZmlndXJhdGlvbjoge1xyXG4gICAgICAgICAgICBpbmZlcmVuY2VDb25maWc6IHtcclxuICAgICAgICAgICAgICB0ZXh0SW5mZXJlbmNlQ29uZmlnOiB7XHJcbiAgICAgICAgICAgICAgICB0ZW1wZXJhdHVyZTogMC40LCAvLyBTbGlnaHRseSBoaWdoZXIgZm9yIGZyaWVuZGxpZXIsIG1vcmUgbmF0dXJhbCByZXNwb25zZXNcclxuICAgICAgICAgICAgICAgIHRvcFA6IDAuOSxcclxuICAgICAgICAgICAgICAgIG1heFRva2VuczogMTAwMDAsXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgLy9zZXNzaW9uSWQ6IGV2ZW50LnNlc3Npb25JZFxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBjb21tYW5kID0gbmV3IFJldHJpZXZlQW5kR2VuZXJhdGVDb21tYW5kKGlucHV0KTtcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2xpZW50LnNlbmQoY29tbWFuZCk7XHJcblxyXG4gICAgYXdhaXQgZGRiLnNlbmQoXHJcbiAgICAgIG5ldyBVcGRhdGVDb21tYW5kKHtcclxuICAgICAgICBUYWJsZU5hbWU6IHByb2Nlc3MuZW52LlRBQkxFX05BTUUhLFxyXG4gICAgICAgIEtleToge1xyXG4gICAgICAgICAgc2Vzc2lvbklkOiBzZXNzaW9uSWQsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBVcGRhdGVFeHByZXNzaW9uOiBgXHJcbiAgICAgICAgU0VUIHF1ZXN0aW9ucyA9IGxpc3RfYXBwZW5kKGlmX25vdF9leGlzdHMocXVlc3Rpb25zLCA6ZW1wdHlfbGlzdCksIDpuZXdfcXVlc3Rpb24pLFxyXG4gICAgICAgICAgICByZXNwb25zZXMgPSBsaXN0X2FwcGVuZChpZl9ub3RfZXhpc3RzKHJlc3BvbnNlcywgOmVtcHR5X2xpc3QpLCA6bmV3X3Jlc3BvbnNlKVxyXG4gICAgICBgLFxyXG4gICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcclxuICAgICAgICAgIFwiOmVtcHR5X2xpc3RcIjogW10sXHJcbiAgICAgICAgICBcIjpuZXdfcXVlc3Rpb25cIjogW3VzZXJRdWVzdGlvbl0sXHJcbiAgICAgICAgICBcIjpuZXdfcmVzcG9uc2VcIjogW3Jlc3BvbnNlLm91dHB1dD8udGV4dF0sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3RhdHVzQ29kZTogMjAwLFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogXCIqXCIsXHJcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6XHJcbiAgICAgICAgICBcIkNvbnRlbnQtVHlwZSxYLUFtei1EYXRlLEF1dGhvcml6YXRpb24sWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuXCIsXHJcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCI6XHJcbiAgICAgICAgICBcIkRFTEVURSxHRVQsSEVBRCxPUFRJT05TLFBVVCxQT1NULFBBVENIXCIsXHJcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1NYXgtQWdlXCI6IFwiODY0MDBcIixcclxuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcclxuICAgICAgfSxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgIGFuc3dlcjogcmVzcG9uc2Uub3V0cHV0Py50ZXh0LFxyXG4gICAgICAgIHNlc3Npb25JZDogc2Vzc2lvbklkLFxyXG4gICAgICB9KSxcclxuICAgIH07XHJcbiAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvcjpcIiwgZXJyb3IpO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3RhdHVzQ29kZTogNTAwLFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogXCIqXCIsXHJcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6XHJcbiAgICAgICAgICBcIkNvbnRlbnQtVHlwZSxYLUFtei1EYXRlLEF1dGhvcml6YXRpb24sWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuXCIsXHJcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCI6XHJcbiAgICAgICAgICBcIkRFTEVURSxHRVQsSEVBRCxPUFRJT05TLFBVVCxQT1NULFBBVENIXCIsXHJcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1NYXgtQWdlXCI6IFwiODY0MDBcIixcclxuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcclxuICAgICAgfSxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgIGVycm9yOlxyXG4gICAgICAgICAgXCJPb3BzISBIYWQgdHJvdWJsZSBhY2Nlc3NpbmcgdGhlIGJ1aWxkaW5nIGluZm8uIFRyeSBhZ2FpbiBvciBjb250YWN0IGJhaDEyLXJlY2VwdGlvbkBhbWF6b24uY29tXCIsXHJcbiAgICAgIH0pLFxyXG4gICAgfTtcclxuICB9XHJcbn07XHJcbiJdfQ==