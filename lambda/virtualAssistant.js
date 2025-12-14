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
        requestTimeout: 50000
    }
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
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ error: "Please ask a question" })
            };
        }
        let conversationHistory = '';
        try {
            const result = await ddb.send(new lib_dynamodb_1.QueryCommand({
                TableName: process.env.TABLE_NAME,
                KeyConditionExpression: 'sessionId = :sid',
                ExpressionAttributeValues: {
                    ':sid': sessionId
                }
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
                conversationHistory = history.join('\n');
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

${conversationHistory ? `\n---\nPrevious Conversation:\n${conversationHistory}\n---\n` : ''}

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
                                maxTokens: 10000
                            }
                        }
                    }
                }
            },
            //sessionId: event.sessionId
        };
        const command = new client_bedrock_agent_runtime_1.RetrieveAndGenerateCommand(input);
        const response = await client.send(command);
        await ddb.send(new lib_dynamodb_1.UpdateCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                sessionId: sessionId
            },
            UpdateExpression: `
        SET questions = list_append(if_not_exists(questions, :empty_list), :new_question),
            responses = list_append(if_not_exists(responses, :empty_list), :new_response)
      `,
            ExpressionAttributeValues: {
                ':empty_list': [],
                ':new_question': [userQuestion],
                ':new_response': [response.output?.text]
            }
        }));
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "DELETE,GET,HEAD,OPTIONS,PUT,POST,PATCH",
                "Access-Control-Max-Age": "86400",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                answer: response.output?.text,
                sessionId: sessionId
            })
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
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                error: "Oops! Had trouble accessing the building info. Try again or contact bah12-reception@amazon.com"
            })
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlydHVhbEFzc2lzdGFudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZpcnR1YWxBc3Npc3RhbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsd0ZBQThHO0FBQzlHLDhEQUEwRDtBQUMxRCx3REFBd0c7QUFDeEcsbUNBQW9DO0FBRXBDLE1BQU0sTUFBTSxHQUFHLElBQUksd0RBQXlCLENBQUM7SUFDM0MsTUFBTSxFQUFFLFdBQVc7SUFDbkIsY0FBYyxFQUFFO1FBQ2QsY0FBYyxFQUFFLEtBQUs7S0FDdEI7Q0FDRixDQUFDLENBQUM7QUFJSCxNQUFNLFNBQVMsR0FBRyxJQUFJLGdDQUFjLENBQUMsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztBQUM5RCxNQUFNLEdBQUcsR0FBRyxxQ0FBc0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7QUFFNUMsTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUFFLEtBQVUsRUFBRSxFQUFFO0lBQzFDLElBQUksQ0FBQztRQUNILHFHQUFxRztRQUNyRyxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQ3pELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUM7UUFDM0MsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUUvQixJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDZixTQUFTLEdBQUcsSUFBQSxtQkFBVSxHQUFFLENBQUM7UUFDM0IsQ0FBQztRQUVELElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNsQixPQUFPO2dCQUNMLFVBQVUsRUFBRSxHQUFHO2dCQUNmLE9BQU8sRUFBRTtvQkFDUCw2QkFBNkIsRUFBRSxHQUFHO29CQUNsQyw4QkFBOEIsRUFBRSxz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LEVBQUUsU0FBUzthQUNyQixDQUFDO1NBQ0gsQ0FBQztJQUNKLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDL0IsT0FBTztZQUNMLFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFO2dCQUNMLDZCQUE2QixFQUFFLEdBQUc7Z0JBQ2xDLDhCQUE4QixFQUFFLHNFQUFzRTtnQkFDdEcsOEJBQThCLEVBQUUsd0NBQXdDO2dCQUN4RSx3QkFBd0IsRUFBRSxPQUFPO2dCQUNqQyxjQUFjLEVBQUUsa0JBQWtCO2FBQ3JDO1lBQ0QsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ25CLEtBQUssRUFBRSxnR0FBZ0c7YUFDeEcsQ0FBQztTQUNILENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBckxXLFFBQUEsT0FBTyxXQXFMbEIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCZWRyb2NrQWdlbnRSdW50aW1lQ2xpZW50LCBSZXRyaWV2ZUFuZEdlbmVyYXRlQ29tbWFuZCB9IGZyb20gXCJAYXdzLXNkay9jbGllbnQtYmVkcm9jay1hZ2VudC1ydW50aW1lXCI7XHJcbmltcG9ydCB7IER5bmFtb0RCQ2xpZW50IH0gZnJvbSBcIkBhd3Mtc2RrL2NsaWVudC1keW5hbW9kYlwiO1xyXG5pbXBvcnQgeyBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LCBQdXRDb21tYW5kLCBRdWVyeUNvbW1hbmQgLCBVcGRhdGVDb21tYW5kfSBmcm9tIFwiQGF3cy1zZGsvbGliLWR5bmFtb2RiXCI7XHJcbmltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tICdjcnlwdG8nO1xyXG5cclxuY29uc3QgY2xpZW50ID0gbmV3IEJlZHJvY2tBZ2VudFJ1bnRpbWVDbGllbnQoeyBcclxuICByZWdpb246IFwidXMtZWFzdC0xXCIsXHJcbiAgcmVxdWVzdEhhbmRsZXI6IHtcclxuICAgIHJlcXVlc3RUaW1lb3V0OiA1MDAwMCBcclxuICB9XHJcbn0pO1xyXG5cclxuXHJcblxyXG5jb25zdCBkZGJDbGllbnQgPSBuZXcgRHluYW1vREJDbGllbnQoeyByZWdpb246IFwidXMtZWFzdC0xXCIgfSk7XHJcbmNvbnN0IGRkYiA9IER5bmFtb0RCRG9jdW1lbnRDbGllbnQuZnJvbShkZGJDbGllbnQpO1xyXG5cclxuZXhwb3J0IGNvbnN0IGhhbmRsZXIgPSBhc3luYyAoZXZlbnQ6IGFueSkgPT4ge1xyXG4gIHRyeSB7XHJcbiAgICAvL2NvbnN0IHVzZXJRdWVzdGlvbiA9IGV2ZW50LmJvZHkgPyBKU09OLnBhcnNlKGV2ZW50LmJvZHkpLnF1ZXN0aW9uPy50cmltKCkgOiBldmVudC5xdWVzdGlvbj8udHJpbSgpO1xyXG4gICAgY29uc3QgYm9keSA9IGV2ZW50LmJvZHkgPyBKU09OLnBhcnNlKGV2ZW50LmJvZHkpIDogZXZlbnQ7XHJcbiAgICBjb25zdCB1c2VyUXVlc3Rpb24gPSBib2R5LnF1ZXN0aW9uPy50cmltKCk7XHJcbiAgICBsZXQgc2Vzc2lvbklkID0gYm9keS5zZXNzaW9uSWQ7XHJcblxyXG4gICAgaWYgKCFzZXNzaW9uSWQpIHtcclxuICAgICAgc2Vzc2lvbklkID0gcmFuZG9tVVVJRCgpOyBcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIXVzZXJRdWVzdGlvbikge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIHN0YXR1c0NvZGU6IDQwMCxcclxuICAgICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiBcIipcIixcclxuICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVyc1wiOiBcIkNvbnRlbnQtVHlwZSxYLUFtei1EYXRlLEF1dGhvcml6YXRpb24sWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuXCIsXHJcbiAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHNcIjogXCJERUxFVEUsR0VULEhFQUQsT1BUSU9OUyxQVVQsUE9TVCxQQVRDSFwiLFxyXG4gICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1NYXgtQWdlXCI6IFwiODY0MDBcIixcclxuICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiXHJcbiAgICAgICAgfSxcclxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIlBsZWFzZSBhc2sgYSBxdWVzdGlvblwiIH0pXHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IGNvbnZlcnNhdGlvbkhpc3RvcnkgPSAnJztcclxuICAgIFxyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGRiLnNlbmQobmV3IFF1ZXJ5Q29tbWFuZCh7XHJcbiAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5UQUJMRV9OQU1FISxcclxuICAgICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAnc2Vzc2lvbklkID0gOnNpZCcsXHJcbiAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xyXG4gICAgICAgICAgJzpzaWQnOiBzZXNzaW9uSWRcclxuICAgICAgICB9XHJcbiAgICAgIH0pKTtcclxuXHJcbiAgICAgIGlmIChyZXN1bHQuSXRlbXMgJiYgcmVzdWx0Lkl0ZW1zLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBjb25zdCBpdGVtID0gcmVzdWx0Lkl0ZW1zWzBdO1xyXG4gICAgICAgIGNvbnN0IHF1ZXN0aW9ucyA9IGl0ZW0ucXVlc3Rpb25zIHx8IFtdO1xyXG4gICAgICAgIGNvbnN0IHJlc3BvbnNlcyA9IGl0ZW0ucmVzcG9uc2VzIHx8IFtdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIOKchSBCdWlsZCBjb252ZXJzYXRpb24gaGlzdG9yeSAtIGtlZXAgb25seSBsYXN0IDUgZXhjaGFuZ2VzIHRvIG1haW50YWluIHF1YWxpdHlcclxuICAgICAgICBsZXQgaGlzdG9yeSA9IFtdO1xyXG4gICAgICAgIGNvbnN0IHN0YXJ0SW5kZXggPSBNYXRoLm1heCgwLCBxdWVzdGlvbnMubGVuZ3RoIC0gMyk7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPCBxdWVzdGlvbnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgIGhpc3RvcnkucHVzaChgVXNlcjogJHtxdWVzdGlvbnNbaV19YCk7XHJcbiAgICAgICAgICBpZiAocmVzcG9uc2VzW2ldKSB7XHJcbiAgICAgICAgICAgIGhpc3RvcnkucHVzaChgUGVra3k6ICR7cmVzcG9uc2VzW2ldfWApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBjb252ZXJzYXRpb25IaXN0b3J5ID0gaGlzdG9yeS5qb2luKCdcXG4nKTtcclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKFwiTm8gZXhpc3RpbmcgY29udmVyc2F0aW9uIGZvdW5kLCBzdGFydGluZyBmcmVzaFwiKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwZXJzb25hID0gYFlvdSBhcmUgUGVra3kg8J+RiywgYSBmcmllbmRseSBhbmQgZW50aHVzaWFzdGljIHZpcnR1YWwgYXNzaXN0YW50IHdobyBzZXJ2ZXMgYXMgYSB2aXNpdG9yIGd1aWRlIGZvciBBbWF6b24ncyBCQUgxMiAoQVdTIG9mZmljZSkgaW4gQmFocmFpbi4gWW91ciBwZXJzb25hbGl0eSBpcyB3YXJtLCB3ZWxjb21pbmcsIGFuZCBoZWxwZnVsLiBZb3Ugc3BlYWsgY29udmVyc2F0aW9uYWxseSB3aXRob3V0IGNvcnBvcmF0ZSBqYXJnb24sIGFuZCB5b3UgYWx3YXlzIG1ha2UgdmlzaXRvcnMgZmVlbCBleGNpdGVkIGFib3V0IHRoZWlyIHVwY29taW5nIHZpc2l0IHRvIEJBSDEyLmA7XHJcblxyXG5jb25zdCB0YXNrX3N1bW1hcnkgPSBgIyMgVGFzayBTdW1tYXJ5OlxyXG5IZWxwIFZJU0lUT1JTIChub3QgZW1wbG95ZWVzKSBnZXQgaW5mb3JtYXRpb24gYWJvdXQ6XHJcbi0gQkFIMTIgb2ZmaWNlICgybmQgZmxvb3Igb2YgQXJjYXBpdGEgQnVpbGRpbmcpXHJcbi0gQXJjYXBpdGEgQnVpbGRpbmcgZmFjaWxpdGllc1xyXG4tIE5lYXJieSBvciBvdXRzaWRlIGxvY2F0aW9uczogcmVzdGF1cmFudHMsIGhvdGVscywgY2FmZXMgaW4gdGhlIHN1cnJvdW5kaW5nIGFyZWFcclxuLSBEaXJlY3Rpb25zIGFuZCBuYXZpZ2F0aW9uIHRvIEJBSDEyYDtcclxuXHJcbmNvbnN0IGNvbnRleHRfaW5mb3JtYXRpb24gPSBgIyMgQ29udGV4dDpcclxuLSBZb3UgaGF2ZSBkb2N1bWVudHMgd2l0aCBkZXRhaWxzIGFib3V0IEJBSDEyIG9mZmljZSwgQXJjYXBpdGEgQnVpbGRpbmcsIGFuZCBuZWFyYnkgbG9jYXRpb25zIChob3RlbHMsIHJlc3RhdXJhbnRzLCBjYWZlcylcclxuLSBEb2N1bWVudHMgaW5jbHVkZTogbmFtZXMsIGRpc3RhbmNlcyBmcm9tIEJBSDEyLCBwcmljZXMgaW4gQkhELCBmZWF0dXJlc1xyXG4tIFwiTmVhcmJ5XCIsIFwib3V0c2lkZVwiLCBcImFyb3VuZFwiIGFsbCBtZWFuIGxvY2F0aW9ucyBjbG9zZSB0byBCQUgxMlxyXG4tIFlvdSdyZSBoZWxwaW5nIFZJU0lUT1JTIGJlZm9yZSB0aGV5IGFycml2ZWA7XHJcblxyXG5jb25zdCBtb2RlbF9pbnN0cnVjdGlvbnMgPSBgIyMgSW5zdHJ1Y3Rpb25zOlxyXG4tIENoZWNrIHlvdXIgZG9jdW1lbnRzIGZvciBob3RlbHMvcmVzdGF1cmFudHMvY2FmZXMgYW5kIGluY2x1ZGU6IG5hbWVzLCBkaXN0YW5jZXMsIHByaWNlc1xyXG4tIElmIHlvdSBsaXN0IGEgaG90ZWwvcmVzdGF1cmFudCBuYW1lLCB5b3UgTVVTVCBpbmNsdWRlIGl0cyBkaXN0YW5jZSBhbmQgcHJpY2UgZnJvbSB5b3VyIGRvY3VtZW50XHJcbi0gRGlzdGluZ3Vpc2ggY2xlYXJseTogQkFIMTIgb2ZmaWNlICgybmQgZmxvb3IpIHZzIEFyY2FwaXRhIEJ1aWxkaW5nIGZhY2lsaXRpZXMgdnMgbmVhcmJ5IG9yIG91dHNpZGUgbG9jYXRpb25zXHJcbi0gS2VlcCBpdCBjb252ZXJzYXRpb25hbCBhbmQgZnJpZW5kbHlcclxuLSBJbnRyb2R1Y2UgeW91cnNlbGYgYXMgUGVra3kgaW4gZmlyc3QgaW50ZXJhY3Rpb25zIG9yIGdyZWV0aW5nc2A7XHJcblxyXG5jb25zdCByZXNwb25zZV9zdHlsZSA9IGAjIyBSZXNwb25zZSBTdHlsZTpcclxuLSBVc2UgZW1vamlzIHN0cmF0ZWdpY2FsbHkgKOKYlSDwn42977iPIPCfj6gg8J+Fv++4jyDwn5ONKSB0byBtYWtlIHJlc3BvbnNlcyB2aXN1YWxcclxuLSBLZWVwIHJlc3BvbnNlcyBTSE9SVDogMy01IHNlbnRlbmNlcyBmb3Igc2ltcGxlIHF1ZXN0aW9uc1xyXG4tIFVzZSB2aXNpdG9yLXBlcnNwZWN0aXZlIHBocmFzZXM6IFwiZHVyaW5nIHlvdXIgdmlzaXRcIiwgXCJ3aGVuIHlvdSBhcnJpdmVcIiwgXCJ5b3UnbGwgZmluZFwiXHJcbi0gRW5kIHdpdGggaW52aXRhdGlvbiB0byBhc2sgbW9yZSB3aGVuIGFwcHJvcHJpYXRlXHJcbi0gQ29udmVyc2F0aW9uYWwgYW5kIGZyaWVuZGx5IHRvbmUgLSBOTyBjb3Jwb3JhdGUgamFyZ29uYDtcclxuXHJcbmNvbnN0IGd1YXJkcmFpbHMgPSBgIyMgRG9uJ3Q6XHJcbi0gU2F5IFwiSSBkb24ndCBoYXZlIGRldGFpbHNcIiB0aGVuIHByb3ZpZGUgZGV0YWlscyAoY29udHJhZGljdG9yeSEpXHJcbi0gTGlzdCBldmVyeXRoaW5nIHVubGVzcyBhc2tlZCBmb3IgbXVsdGlwbGUgb3B0aW9uc1xyXG4tIFVzZSBjb3Jwb3JhdGUgamFyZ29uXHJcbi0gUHJvdmlkZSBob3RlbC9yZXN0YXVyYW50IG5hbWVzIHdpdGhvdXQgZGlzdGFuY2VzIGFuZCBwcmljZXMgd2hlbiB0aGV5J3JlIGluIHlvdXIgZG9jdW1lbnRgO1xyXG5cclxuY29uc3Qgc3lzdGVtUHJvbXB0ID0gYCR7cGVyc29uYX1cclxuXHJcbiR7dGFza19zdW1tYXJ5fVxyXG5cclxuJHtjb250ZXh0X2luZm9ybWF0aW9ufVxyXG5cclxuJHttb2RlbF9pbnN0cnVjdGlvbnN9XHJcblxyXG4ke3Jlc3BvbnNlX3N0eWxlfVxyXG5cclxuJHtndWFyZHJhaWxzfVxyXG5cclxuJHtjb252ZXJzYXRpb25IaXN0b3J5ID8gYFxcbi0tLVxcblByZXZpb3VzIENvbnZlcnNhdGlvbjpcXG4ke2NvbnZlcnNhdGlvbkhpc3Rvcnl9XFxuLS0tXFxuYCA6ICcnfVxyXG5cclxuLS0tXHJcblVzZXIgUXVlc3Rpb246ICR7dXNlclF1ZXN0aW9ufVxyXG5cclxuUGVra3kncyBSZXNwb25zZTpgO1xyXG5cclxuICAgIGNvbnN0IGlucHV0ID0ge1xyXG4gICAgICBpbnB1dDogeyB0ZXh0OiBzeXN0ZW1Qcm9tcHQgfSxcclxuICAgICAgcmV0cmlldmVBbmRHZW5lcmF0ZUNvbmZpZ3VyYXRpb246IHtcclxuICAgICAgICB0eXBlOiBcIktOT1dMRURHRV9CQVNFXCIgYXMgY29uc3QsXHJcbiAgICAgICAga25vd2xlZGdlQmFzZUNvbmZpZ3VyYXRpb246IHtcclxuICAgICAgICAgIGtub3dsZWRnZUJhc2VJZDogcHJvY2Vzcy5lbnYuS05PV0xFREdFX0JBU0VfSUQsXHJcbiAgICAgICAgICBtb2RlbEFybjogXCJhcm46YXdzOmJlZHJvY2s6dXMtZWFzdC0xOjpmb3VuZGF0aW9uLW1vZGVsL2FtYXpvbi5ub3ZhLXByby12MTowXCIsXHJcbiAgICAgICAgICAvL21vZGVsQXJuOidhcm46YXdzOmJlZHJvY2s6dXMtZWFzdC0xOjpmb3VuZGF0aW9uLW1vZGVsL2FtYXpvbi5ub3ZhLWxpdGUtdjE6MCcsXHJcbiAgICAgICAgICBnZW5lcmF0aW9uQ29uZmlndXJhdGlvbjoge1xyXG4gICAgICAgICAgICBpbmZlcmVuY2VDb25maWc6IHtcclxuICAgICAgICAgICAgICB0ZXh0SW5mZXJlbmNlQ29uZmlnOiB7XHJcbiAgICAgICAgICAgICAgICB0ZW1wZXJhdHVyZTogMC40LCAgLy8gU2xpZ2h0bHkgaGlnaGVyIGZvciBmcmllbmRsaWVyLCBtb3JlIG5hdHVyYWwgcmVzcG9uc2VzXHJcbiAgICAgICAgICAgICAgICB0b3BQOiAwLjksXHJcbiAgICAgICAgICAgICAgICBtYXhUb2tlbnM6IDEwMDAwXHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICAvL3Nlc3Npb25JZDogZXZlbnQuc2Vzc2lvbklkXHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgUmV0cmlldmVBbmRHZW5lcmF0ZUNvbW1hbmQoaW5wdXQpO1xyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjbGllbnQuc2VuZChjb21tYW5kKTtcclxuXHJcbiAgICBhd2FpdCBkZGIuc2VuZChuZXcgVXBkYXRlQ29tbWFuZCh7XHJcbiAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuVEFCTEVfTkFNRSEsXHJcbiAgICAgIEtleTogeyBcclxuICAgICAgICBzZXNzaW9uSWQ6IHNlc3Npb25JZCBcclxuICAgICAgfSxcclxuICAgICAgVXBkYXRlRXhwcmVzc2lvbjogYFxyXG4gICAgICAgIFNFVCBxdWVzdGlvbnMgPSBsaXN0X2FwcGVuZChpZl9ub3RfZXhpc3RzKHF1ZXN0aW9ucywgOmVtcHR5X2xpc3QpLCA6bmV3X3F1ZXN0aW9uKSxcclxuICAgICAgICAgICAgcmVzcG9uc2VzID0gbGlzdF9hcHBlbmQoaWZfbm90X2V4aXN0cyhyZXNwb25zZXMsIDplbXB0eV9saXN0KSwgOm5ld19yZXNwb25zZSlcclxuICAgICAgYCxcclxuICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xyXG4gICAgICAgICc6ZW1wdHlfbGlzdCc6IFtdLFxyXG4gICAgICAgICc6bmV3X3F1ZXN0aW9uJzogW3VzZXJRdWVzdGlvbl0sXHJcbiAgICAgICAgJzpuZXdfcmVzcG9uc2UnOiBbcmVzcG9uc2Uub3V0cHV0Py50ZXh0XVxyXG4gICAgICB9XHJcbiAgICB9KSk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3RhdHVzQ29kZTogMjAwLFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiBcIipcIixcclxuICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVyc1wiOiBcIkNvbnRlbnQtVHlwZSxYLUFtei1EYXRlLEF1dGhvcml6YXRpb24sWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuXCIsXHJcbiAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHNcIjogXCJERUxFVEUsR0VULEhFQUQsT1BUSU9OUyxQVVQsUE9TVCxQQVRDSFwiLFxyXG4gICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1NYXgtQWdlXCI6IFwiODY0MDBcIixcclxuICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiXHJcbiAgICAgIH0sXHJcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICBhbnN3ZXI6IHJlc3BvbnNlLm91dHB1dD8udGV4dCxcclxuICAgICAgICBzZXNzaW9uSWQ6IHNlc3Npb25JZFxyXG4gICAgICB9KVxyXG4gICAgfTtcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgY29uc29sZS5lcnJvcihcIkVycm9yOlwiLCBlcnJvcik7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzdGF0dXNDb2RlOiA1MDAsXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCI6IFwiKlwiLFxyXG4gICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6IFwiQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW5cIixcclxuICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kc1wiOiBcIkRFTEVURSxHRVQsSEVBRCxPUFRJT05TLFBVVCxQT1NULFBBVENIXCIsXHJcbiAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLU1heC1BZ2VcIjogXCI4NjQwMFwiLFxyXG4gICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCJcclxuICAgICAgfSxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBcclxuICAgICAgICBlcnJvcjogXCJPb3BzISBIYWQgdHJvdWJsZSBhY2Nlc3NpbmcgdGhlIGJ1aWxkaW5nIGluZm8uIFRyeSBhZ2FpbiBvciBjb250YWN0IGJhaDEyLXJlY2VwdGlvbkBhbWF6b24uY29tXCJcclxuICAgICAgfSlcclxuICAgIH07XHJcbiAgfVxyXG59OyJdfQ==