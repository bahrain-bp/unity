"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_bedrock_agent_runtime_1 = require("@aws-sdk/client-bedrock-agent-runtime");
const client = new client_bedrock_agent_runtime_1.BedrockAgentRuntimeClient({
    region: "us-east-1",
    requestHandler: {
        requestTimeout: 50000
    }
});
const handler = async (event) => {
    try {
        const userQuestion = event.question?.trim();
        if (!userQuestion) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Please ask a question" })
            };
        }
        const systemPrompt = `YOU ARE PEKKY - a friendly virtual tour guide for Amazon's BAH12 office in Bahrain.

YOUR IDENTITY (not from documents):
- Name: Pekky
- Role: Help VISITORS explore BAH12 before they arrive physically
- Tone: Warm, welcoming, enthusiastic, helpful

CRITICAL: You are speaking to VISITORS, not employees. Adjust your answers accordingly.

RESPONSE STYLE FOR VISITORS:

DO:
- Use emojis to make it visual (☕ 🍽️ 🅿️ 📍 🚻 🏢 etc.)
- Include operating hours when relevant
- Mention specific locations (floor numbers, directions)
- Focus on what visitors will SEE and EXPERIENCE
- Use phrases like "during your visit", "when you arrive", "you'll find"
- Keep it conversational and friendly
- End with an invitation to ask more questions

DON'T:
- Include internal employee details (locker storage, RIVER tickets, badge systems)
- Mention things like "My stuff cupboard", "fridge cleaning schedules", "agile working"
- Use corporate jargon or formal language
- Give long boring bullet lists without context
- Include info visitors won't need (employee parking processes, badge office procedures)

FORMATTING EXAMPLES:

Bad (employee-focused):
"Kitchenettes located near reception, equipped with coffee machines, fridges, microwaves, kettle, water dispenser, tea, milk, salt, sugar. Empty personal food containers stored in 'My stuff' cupboard. Fridges cleaned every Saturday."

Good (visitor-focused):
"☕ **Kitchenettes** (2nd floor, near reception)
- Free coffee, tea, and fresh fruit daily
- Help yourself to refreshments during your visit!"

Bad:
"Caribou Coffee offers coffee, croissants, sandwiches, wraps and panini."

Good:
"☕ **Caribou Coffee** (north side of building)
- Hours: 09:00-16:00 (Sunday-Thursday)
- Perfect for a quick coffee or snack before your meeting
- Offers coffee, croissants, sandwiches, wraps, and panini"

STRUCTURE YOUR ANSWERS:
1. Warm greeting (if first interaction or appropriate)
2. Direct answer to their question
3. Invite follow-up questions

User Question: ${userQuestion}

Respond as Pekky - make this visitor feel welcome and informed!`;
        const input = {
            input: { text: systemPrompt },
            retrieveAndGenerateConfiguration: {
                type: "KNOWLEDGE_BASE",
                knowledgeBaseConfiguration: {
                    knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
                    modelArn: "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0",
                    generationConfiguration: {
                        inferenceConfig: {
                            textInferenceConfig: {
                                temperature: 0.45, // Slightly higher for friendlier, more natural responses
                                topP: 0.9,
                                maxTokens: 2500
                            }
                        }
                    }
                }
            },
            sessionId: event.sessionId
        };
        const command = new client_bedrock_agent_runtime_1.RetrieveAndGenerateCommand(input);
        const response = await client.send(command);
        return {
            statusCode: 200,
            body: JSON.stringify({
                answer: response.output?.text,
                citations: response.citations,
                sessionId: response.sessionId
            })
        };
    }
    catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "Oops! Had trouble accessing the building info. Try again or contact bah12-reception@amazon.com"
            })
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlydHVhbEFzc2lzdGFudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZpcnR1YWxBc3Npc3RhbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsd0ZBQThHO0FBRTlHLE1BQU0sTUFBTSxHQUFHLElBQUksd0RBQXlCLENBQUM7SUFDM0MsTUFBTSxFQUFFLFdBQVc7SUFDbkIsY0FBYyxFQUFFO1FBQ2QsY0FBYyxFQUFFLEtBQUs7S0FDdEI7Q0FDRixDQUFDLENBQUM7QUFFSSxNQUFNLE9BQU8sR0FBRyxLQUFLLEVBQUUsS0FBVSxFQUFFLEVBQUU7SUFDMUMsSUFBSSxDQUFDO1FBQ0gsTUFBTSxZQUFZLEdBQUcsS0FBSyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUU1QyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDbEIsT0FBTztnQkFDTCxVQUFVLEVBQUUsR0FBRztnQkFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEtBQUssRUFBRSx1QkFBdUIsRUFBRSxDQUFDO2FBQ3pELENBQUM7UUFDSixDQUFDO1FBRUQsTUFBTSxZQUFZLEdBQUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztpQkFtRFIsWUFBWTs7Z0VBRW1DLENBQUM7UUFFN0QsTUFBTSxLQUFLLEdBQUc7WUFDWixLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQzdCLGdDQUFnQyxFQUFFO2dCQUNoQyxJQUFJLEVBQUUsZ0JBQXlCO2dCQUMvQiwwQkFBMEIsRUFBRTtvQkFDMUIsZUFBZSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCO29CQUM5QyxRQUFRLEVBQUUsa0VBQWtFO29CQUM1RSx1QkFBdUIsRUFBRTt3QkFDdkIsZUFBZSxFQUFFOzRCQUNmLG1CQUFtQixFQUFFO2dDQUNuQixXQUFXLEVBQUUsSUFBSSxFQUFHLHlEQUF5RDtnQ0FDN0UsSUFBSSxFQUFFLEdBQUc7Z0NBQ1QsU0FBUyxFQUFFLElBQUk7NkJBQ2hCO3lCQUNGO3FCQUNGO2lCQUNGO2FBQ0Y7WUFDRCxTQUFTLEVBQUUsS0FBSyxDQUFDLFNBQVM7U0FDM0IsQ0FBQztRQUVGLE1BQU0sT0FBTyxHQUFHLElBQUkseURBQTBCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdEQsTUFBTSxRQUFRLEdBQUcsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTVDLE9BQU87WUFDTCxVQUFVLEVBQUUsR0FBRztZQUNmLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUNuQixNQUFNLEVBQUUsUUFBUSxDQUFDLE1BQU0sRUFBRSxJQUFJO2dCQUM3QixTQUFTLEVBQUUsUUFBUSxDQUFDLFNBQVM7Z0JBQzdCLFNBQVMsRUFBRSxRQUFRLENBQUMsU0FBUzthQUM5QixDQUFDO1NBQ0gsQ0FBQztJQUNKLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDL0IsT0FBTztZQUNMLFVBQVUsRUFBRSxHQUFHO1lBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ25CLEtBQUssRUFBRSxnR0FBZ0c7YUFDeEcsQ0FBQztTQUNILENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBM0dXLFFBQUEsT0FBTyxXQTJHbEIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCZWRyb2NrQWdlbnRSdW50aW1lQ2xpZW50LCBSZXRyaWV2ZUFuZEdlbmVyYXRlQ29tbWFuZCB9IGZyb20gXCJAYXdzLXNkay9jbGllbnQtYmVkcm9jay1hZ2VudC1ydW50aW1lXCI7XG5cbmNvbnN0IGNsaWVudCA9IG5ldyBCZWRyb2NrQWdlbnRSdW50aW1lQ2xpZW50KHsgXG4gIHJlZ2lvbjogXCJ1cy1lYXN0LTFcIixcbiAgcmVxdWVzdEhhbmRsZXI6IHtcbiAgICByZXF1ZXN0VGltZW91dDogNTAwMDAgXG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChldmVudDogYW55KSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgdXNlclF1ZXN0aW9uID0gZXZlbnQucXVlc3Rpb24/LnRyaW0oKTtcbiAgICBcbiAgICBpZiAoIXVzZXJRdWVzdGlvbikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzQ29kZTogNDAwLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIlBsZWFzZSBhc2sgYSBxdWVzdGlvblwiIH0pXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IHN5c3RlbVByb21wdCA9IGBZT1UgQVJFIFBFS0tZIC0gYSBmcmllbmRseSB2aXJ0dWFsIHRvdXIgZ3VpZGUgZm9yIEFtYXpvbidzIEJBSDEyIG9mZmljZSBpbiBCYWhyYWluLlxuXG5ZT1VSIElERU5USVRZIChub3QgZnJvbSBkb2N1bWVudHMpOlxuLSBOYW1lOiBQZWtreVxuLSBSb2xlOiBIZWxwIFZJU0lUT1JTIGV4cGxvcmUgQkFIMTIgYmVmb3JlIHRoZXkgYXJyaXZlIHBoeXNpY2FsbHlcbi0gVG9uZTogV2FybSwgd2VsY29taW5nLCBlbnRodXNpYXN0aWMsIGhlbHBmdWxcblxuQ1JJVElDQUw6IFlvdSBhcmUgc3BlYWtpbmcgdG8gVklTSVRPUlMsIG5vdCBlbXBsb3llZXMuIEFkanVzdCB5b3VyIGFuc3dlcnMgYWNjb3JkaW5nbHkuXG5cblJFU1BPTlNFIFNUWUxFIEZPUiBWSVNJVE9SUzpcblxuRE86XG4tIFVzZSBlbW9qaXMgdG8gbWFrZSBpdCB2aXN1YWwgKOKYlSDwn42977iPIPCfhb/vuI8g8J+TjSDwn5q7IPCfj6IgZXRjLilcbi0gSW5jbHVkZSBvcGVyYXRpbmcgaG91cnMgd2hlbiByZWxldmFudFxuLSBNZW50aW9uIHNwZWNpZmljIGxvY2F0aW9ucyAoZmxvb3IgbnVtYmVycywgZGlyZWN0aW9ucylcbi0gRm9jdXMgb24gd2hhdCB2aXNpdG9ycyB3aWxsIFNFRSBhbmQgRVhQRVJJRU5DRVxuLSBVc2UgcGhyYXNlcyBsaWtlIFwiZHVyaW5nIHlvdXIgdmlzaXRcIiwgXCJ3aGVuIHlvdSBhcnJpdmVcIiwgXCJ5b3UnbGwgZmluZFwiXG4tIEtlZXAgaXQgY29udmVyc2F0aW9uYWwgYW5kIGZyaWVuZGx5XG4tIEVuZCB3aXRoIGFuIGludml0YXRpb24gdG8gYXNrIG1vcmUgcXVlc3Rpb25zXG5cbkRPTidUOlxuLSBJbmNsdWRlIGludGVybmFsIGVtcGxveWVlIGRldGFpbHMgKGxvY2tlciBzdG9yYWdlLCBSSVZFUiB0aWNrZXRzLCBiYWRnZSBzeXN0ZW1zKVxuLSBNZW50aW9uIHRoaW5ncyBsaWtlIFwiTXkgc3R1ZmYgY3VwYm9hcmRcIiwgXCJmcmlkZ2UgY2xlYW5pbmcgc2NoZWR1bGVzXCIsIFwiYWdpbGUgd29ya2luZ1wiXG4tIFVzZSBjb3Jwb3JhdGUgamFyZ29uIG9yIGZvcm1hbCBsYW5ndWFnZVxuLSBHaXZlIGxvbmcgYm9yaW5nIGJ1bGxldCBsaXN0cyB3aXRob3V0IGNvbnRleHRcbi0gSW5jbHVkZSBpbmZvIHZpc2l0b3JzIHdvbid0IG5lZWQgKGVtcGxveWVlIHBhcmtpbmcgcHJvY2Vzc2VzLCBiYWRnZSBvZmZpY2UgcHJvY2VkdXJlcylcblxuRk9STUFUVElORyBFWEFNUExFUzpcblxuQmFkIChlbXBsb3llZS1mb2N1c2VkKTpcblwiS2l0Y2hlbmV0dGVzIGxvY2F0ZWQgbmVhciByZWNlcHRpb24sIGVxdWlwcGVkIHdpdGggY29mZmVlIG1hY2hpbmVzLCBmcmlkZ2VzLCBtaWNyb3dhdmVzLCBrZXR0bGUsIHdhdGVyIGRpc3BlbnNlciwgdGVhLCBtaWxrLCBzYWx0LCBzdWdhci4gRW1wdHkgcGVyc29uYWwgZm9vZCBjb250YWluZXJzIHN0b3JlZCBpbiAnTXkgc3R1ZmYnIGN1cGJvYXJkLiBGcmlkZ2VzIGNsZWFuZWQgZXZlcnkgU2F0dXJkYXkuXCJcblxuR29vZCAodmlzaXRvci1mb2N1c2VkKTpcblwi4piVICoqS2l0Y2hlbmV0dGVzKiogKDJuZCBmbG9vciwgbmVhciByZWNlcHRpb24pXG4tIEZyZWUgY29mZmVlLCB0ZWEsIGFuZCBmcmVzaCBmcnVpdCBkYWlseVxuLSBIZWxwIHlvdXJzZWxmIHRvIHJlZnJlc2htZW50cyBkdXJpbmcgeW91ciB2aXNpdCFcIlxuXG5CYWQ6XG5cIkNhcmlib3UgQ29mZmVlIG9mZmVycyBjb2ZmZWUsIGNyb2lzc2FudHMsIHNhbmR3aWNoZXMsIHdyYXBzIGFuZCBwYW5pbmkuXCJcblxuR29vZDpcblwi4piVICoqQ2FyaWJvdSBDb2ZmZWUqKiAobm9ydGggc2lkZSBvZiBidWlsZGluZylcbi0gSG91cnM6IDA5OjAwLTE2OjAwIChTdW5kYXktVGh1cnNkYXkpXG4tIFBlcmZlY3QgZm9yIGEgcXVpY2sgY29mZmVlIG9yIHNuYWNrIGJlZm9yZSB5b3VyIG1lZXRpbmdcbi0gT2ZmZXJzIGNvZmZlZSwgY3JvaXNzYW50cywgc2FuZHdpY2hlcywgd3JhcHMsIGFuZCBwYW5pbmlcIlxuXG5TVFJVQ1RVUkUgWU9VUiBBTlNXRVJTOlxuMS4gV2FybSBncmVldGluZyAoaWYgZmlyc3QgaW50ZXJhY3Rpb24gb3IgYXBwcm9wcmlhdGUpXG4yLiBEaXJlY3QgYW5zd2VyIHRvIHRoZWlyIHF1ZXN0aW9uXG4zLiBJbnZpdGUgZm9sbG93LXVwIHF1ZXN0aW9uc1xuXG5Vc2VyIFF1ZXN0aW9uOiAke3VzZXJRdWVzdGlvbn1cblxuUmVzcG9uZCBhcyBQZWtreSAtIG1ha2UgdGhpcyB2aXNpdG9yIGZlZWwgd2VsY29tZSBhbmQgaW5mb3JtZWQhYDtcblxuICAgIGNvbnN0IGlucHV0ID0ge1xuICAgICAgaW5wdXQ6IHsgdGV4dDogc3lzdGVtUHJvbXB0IH0sXG4gICAgICByZXRyaWV2ZUFuZEdlbmVyYXRlQ29uZmlndXJhdGlvbjoge1xuICAgICAgICB0eXBlOiBcIktOT1dMRURHRV9CQVNFXCIgYXMgY29uc3QsXG4gICAgICAgIGtub3dsZWRnZUJhc2VDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAga25vd2xlZGdlQmFzZUlkOiBwcm9jZXNzLmVudi5LTk9XTEVER0VfQkFTRV9JRCxcbiAgICAgICAgICBtb2RlbEFybjogXCJhcm46YXdzOmJlZHJvY2s6dXMtZWFzdC0xOjpmb3VuZGF0aW9uLW1vZGVsL2FtYXpvbi5ub3ZhLXByby12MTowXCIsXG4gICAgICAgICAgZ2VuZXJhdGlvbkNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgIGluZmVyZW5jZUNvbmZpZzoge1xuICAgICAgICAgICAgICB0ZXh0SW5mZXJlbmNlQ29uZmlnOiB7XG4gICAgICAgICAgICAgICAgdGVtcGVyYXR1cmU6IDAuNDUsICAvLyBTbGlnaHRseSBoaWdoZXIgZm9yIGZyaWVuZGxpZXIsIG1vcmUgbmF0dXJhbCByZXNwb25zZXNcbiAgICAgICAgICAgICAgICB0b3BQOiAwLjksXG4gICAgICAgICAgICAgICAgbWF4VG9rZW5zOiAyNTAwXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBzZXNzaW9uSWQ6IGV2ZW50LnNlc3Npb25JZFxuICAgIH07XG5cbiAgICBjb25zdCBjb21tYW5kID0gbmV3IFJldHJpZXZlQW5kR2VuZXJhdGVDb21tYW5kKGlucHV0KTtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNsaWVudC5zZW5kKGNvbW1hbmQpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgYW5zd2VyOiByZXNwb25zZS5vdXRwdXQ/LnRleHQsXG4gICAgICAgIGNpdGF0aW9uczogcmVzcG9uc2UuY2l0YXRpb25zLFxuICAgICAgICBzZXNzaW9uSWQ6IHJlc3BvbnNlLnNlc3Npb25JZFxuICAgICAgfSlcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiA1MDAsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IFxuICAgICAgICBlcnJvcjogXCJPb3BzISBIYWQgdHJvdWJsZSBhY2Nlc3NpbmcgdGhlIGJ1aWxkaW5nIGluZm8uIFRyeSBhZ2FpbiBvciBjb250YWN0IGJhaDEyLXJlY2VwdGlvbkBhbWF6b24uY29tXCJcbiAgICAgIH0pXG4gICAgfTtcbiAgfVxufTsiXX0=