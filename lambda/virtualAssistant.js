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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlydHVhbEFzc2lzdGFudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZpcnR1YWxBc3Npc3RhbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsd0ZBQThHO0FBRTlHLE1BQU0sTUFBTSxHQUFHLElBQUksd0RBQXlCLENBQUM7SUFDM0MsTUFBTSxFQUFFLFdBQVc7SUFDbkIsY0FBYyxFQUFFO1FBQ2QsY0FBYyxFQUFFLEtBQUs7S0FDdEI7Q0FDRixDQUFDLENBQUM7QUFFSSxNQUFNLE9BQU8sR0FBRyxLQUFLLEVBQUUsS0FBVSxFQUFFLEVBQUU7SUFDMUMsSUFBSSxDQUFDO1FBQ0gsTUFBTSxZQUFZLEdBQUcsS0FBSyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUU1QyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDbEIsT0FBTztnQkFDTCxVQUFVLEVBQUUsR0FBRztnQkFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEtBQUssRUFBRSx1QkFBdUIsRUFBRSxDQUFDO2FBQ3pELENBQUM7UUFDSixDQUFDO1FBRUQsTUFBTSxZQUFZLEdBQUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztpQkFtRFIsWUFBWTs7Z0VBRW1DLENBQUM7UUFFN0QsTUFBTSxLQUFLLEdBQUc7WUFDWixLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQzdCLGdDQUFnQyxFQUFFO2dCQUNoQyxJQUFJLEVBQUUsZ0JBQXlCO2dCQUMvQiwwQkFBMEIsRUFBRTtvQkFDMUIsZUFBZSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCO29CQUM5QyxRQUFRLEVBQUUsa0VBQWtFO29CQUM1RSx1QkFBdUIsRUFBRTt3QkFDdkIsZUFBZSxFQUFFOzRCQUNmLG1CQUFtQixFQUFFO2dDQUNuQixXQUFXLEVBQUUsSUFBSSxFQUFHLHlEQUF5RDtnQ0FDN0UsSUFBSSxFQUFFLEdBQUc7Z0NBQ1QsU0FBUyxFQUFFLElBQUk7NkJBQ2hCO3lCQUNGO3FCQUNGO2lCQUNGO2FBQ0Y7WUFDRCxTQUFTLEVBQUUsS0FBSyxDQUFDLFNBQVM7U0FDM0IsQ0FBQztRQUVGLE1BQU0sT0FBTyxHQUFHLElBQUkseURBQTBCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdEQsTUFBTSxRQUFRLEdBQUcsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTVDLE9BQU87WUFDTCxVQUFVLEVBQUUsR0FBRztZQUNmLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUNuQixNQUFNLEVBQUUsUUFBUSxDQUFDLE1BQU0sRUFBRSxJQUFJO2dCQUM3QixTQUFTLEVBQUUsUUFBUSxDQUFDLFNBQVM7Z0JBQzdCLFNBQVMsRUFBRSxRQUFRLENBQUMsU0FBUzthQUM5QixDQUFDO1NBQ0gsQ0FBQztJQUNKLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDL0IsT0FBTztZQUNMLFVBQVUsRUFBRSxHQUFHO1lBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ25CLEtBQUssRUFBRSxnR0FBZ0c7YUFDeEcsQ0FBQztTQUNILENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBM0dXLFFBQUEsT0FBTyxXQTJHbEIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCZWRyb2NrQWdlbnRSdW50aW1lQ2xpZW50LCBSZXRyaWV2ZUFuZEdlbmVyYXRlQ29tbWFuZCB9IGZyb20gXCJAYXdzLXNkay9jbGllbnQtYmVkcm9jay1hZ2VudC1ydW50aW1lXCI7XHJcblxyXG5jb25zdCBjbGllbnQgPSBuZXcgQmVkcm9ja0FnZW50UnVudGltZUNsaWVudCh7IFxyXG4gIHJlZ2lvbjogXCJ1cy1lYXN0LTFcIixcclxuICByZXF1ZXN0SGFuZGxlcjoge1xyXG4gICAgcmVxdWVzdFRpbWVvdXQ6IDUwMDAwIFxyXG4gIH1cclxufSk7XHJcblxyXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChldmVudDogYW55KSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHVzZXJRdWVzdGlvbiA9IGV2ZW50LnF1ZXN0aW9uPy50cmltKCk7XHJcbiAgICBcclxuICAgIGlmICghdXNlclF1ZXN0aW9uKSB7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgc3RhdHVzQ29kZTogNDAwLFxyXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiUGxlYXNlIGFzayBhIHF1ZXN0aW9uXCIgfSlcclxuICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBzeXN0ZW1Qcm9tcHQgPSBgWU9VIEFSRSBQRUtLWSAtIGEgZnJpZW5kbHkgdmlydHVhbCB0b3VyIGd1aWRlIGZvciBBbWF6b24ncyBCQUgxMiBvZmZpY2UgaW4gQmFocmFpbi5cclxuXHJcbllPVVIgSURFTlRJVFkgKG5vdCBmcm9tIGRvY3VtZW50cyk6XHJcbi0gTmFtZTogUGVra3lcclxuLSBSb2xlOiBIZWxwIFZJU0lUT1JTIGV4cGxvcmUgQkFIMTIgYmVmb3JlIHRoZXkgYXJyaXZlIHBoeXNpY2FsbHlcclxuLSBUb25lOiBXYXJtLCB3ZWxjb21pbmcsIGVudGh1c2lhc3RpYywgaGVscGZ1bFxyXG5cclxuQ1JJVElDQUw6IFlvdSBhcmUgc3BlYWtpbmcgdG8gVklTSVRPUlMsIG5vdCBlbXBsb3llZXMuIEFkanVzdCB5b3VyIGFuc3dlcnMgYWNjb3JkaW5nbHkuXHJcblxyXG5SRVNQT05TRSBTVFlMRSBGT1IgVklTSVRPUlM6XHJcblxyXG5ETzpcclxuLSBVc2UgZW1vamlzIHRvIG1ha2UgaXQgdmlzdWFsICjimJUg8J+Nve+4jyDwn4W/77iPIPCfk40g8J+auyDwn4+iIGV0Yy4pXHJcbi0gSW5jbHVkZSBvcGVyYXRpbmcgaG91cnMgd2hlbiByZWxldmFudFxyXG4tIE1lbnRpb24gc3BlY2lmaWMgbG9jYXRpb25zIChmbG9vciBudW1iZXJzLCBkaXJlY3Rpb25zKVxyXG4tIEZvY3VzIG9uIHdoYXQgdmlzaXRvcnMgd2lsbCBTRUUgYW5kIEVYUEVSSUVOQ0VcclxuLSBVc2UgcGhyYXNlcyBsaWtlIFwiZHVyaW5nIHlvdXIgdmlzaXRcIiwgXCJ3aGVuIHlvdSBhcnJpdmVcIiwgXCJ5b3UnbGwgZmluZFwiXHJcbi0gS2VlcCBpdCBjb252ZXJzYXRpb25hbCBhbmQgZnJpZW5kbHlcclxuLSBFbmQgd2l0aCBhbiBpbnZpdGF0aW9uIHRvIGFzayBtb3JlIHF1ZXN0aW9uc1xyXG5cclxuRE9OJ1Q6XHJcbi0gSW5jbHVkZSBpbnRlcm5hbCBlbXBsb3llZSBkZXRhaWxzIChsb2NrZXIgc3RvcmFnZSwgUklWRVIgdGlja2V0cywgYmFkZ2Ugc3lzdGVtcylcclxuLSBNZW50aW9uIHRoaW5ncyBsaWtlIFwiTXkgc3R1ZmYgY3VwYm9hcmRcIiwgXCJmcmlkZ2UgY2xlYW5pbmcgc2NoZWR1bGVzXCIsIFwiYWdpbGUgd29ya2luZ1wiXHJcbi0gVXNlIGNvcnBvcmF0ZSBqYXJnb24gb3IgZm9ybWFsIGxhbmd1YWdlXHJcbi0gR2l2ZSBsb25nIGJvcmluZyBidWxsZXQgbGlzdHMgd2l0aG91dCBjb250ZXh0XHJcbi0gSW5jbHVkZSBpbmZvIHZpc2l0b3JzIHdvbid0IG5lZWQgKGVtcGxveWVlIHBhcmtpbmcgcHJvY2Vzc2VzLCBiYWRnZSBvZmZpY2UgcHJvY2VkdXJlcylcclxuXHJcbkZPUk1BVFRJTkcgRVhBTVBMRVM6XHJcblxyXG5CYWQgKGVtcGxveWVlLWZvY3VzZWQpOlxyXG5cIktpdGNoZW5ldHRlcyBsb2NhdGVkIG5lYXIgcmVjZXB0aW9uLCBlcXVpcHBlZCB3aXRoIGNvZmZlZSBtYWNoaW5lcywgZnJpZGdlcywgbWljcm93YXZlcywga2V0dGxlLCB3YXRlciBkaXNwZW5zZXIsIHRlYSwgbWlsaywgc2FsdCwgc3VnYXIuIEVtcHR5IHBlcnNvbmFsIGZvb2QgY29udGFpbmVycyBzdG9yZWQgaW4gJ015IHN0dWZmJyBjdXBib2FyZC4gRnJpZGdlcyBjbGVhbmVkIGV2ZXJ5IFNhdHVyZGF5LlwiXHJcblxyXG5Hb29kICh2aXNpdG9yLWZvY3VzZWQpOlxyXG5cIuKYlSAqKktpdGNoZW5ldHRlcyoqICgybmQgZmxvb3IsIG5lYXIgcmVjZXB0aW9uKVxyXG4tIEZyZWUgY29mZmVlLCB0ZWEsIGFuZCBmcmVzaCBmcnVpdCBkYWlseVxyXG4tIEhlbHAgeW91cnNlbGYgdG8gcmVmcmVzaG1lbnRzIGR1cmluZyB5b3VyIHZpc2l0IVwiXHJcblxyXG5CYWQ6XHJcblwiQ2FyaWJvdSBDb2ZmZWUgb2ZmZXJzIGNvZmZlZSwgY3JvaXNzYW50cywgc2FuZHdpY2hlcywgd3JhcHMgYW5kIHBhbmluaS5cIlxyXG5cclxuR29vZDpcclxuXCLimJUgKipDYXJpYm91IENvZmZlZSoqIChub3J0aCBzaWRlIG9mIGJ1aWxkaW5nKVxyXG4tIEhvdXJzOiAwOTowMC0xNjowMCAoU3VuZGF5LVRodXJzZGF5KVxyXG4tIFBlcmZlY3QgZm9yIGEgcXVpY2sgY29mZmVlIG9yIHNuYWNrIGJlZm9yZSB5b3VyIG1lZXRpbmdcclxuLSBPZmZlcnMgY29mZmVlLCBjcm9pc3NhbnRzLCBzYW5kd2ljaGVzLCB3cmFwcywgYW5kIHBhbmluaVwiXHJcblxyXG5TVFJVQ1RVUkUgWU9VUiBBTlNXRVJTOlxyXG4xLiBXYXJtIGdyZWV0aW5nIChpZiBmaXJzdCBpbnRlcmFjdGlvbiBvciBhcHByb3ByaWF0ZSlcclxuMi4gRGlyZWN0IGFuc3dlciB0byB0aGVpciBxdWVzdGlvblxyXG4zLiBJbnZpdGUgZm9sbG93LXVwIHF1ZXN0aW9uc1xyXG5cclxuVXNlciBRdWVzdGlvbjogJHt1c2VyUXVlc3Rpb259XHJcblxyXG5SZXNwb25kIGFzIFBla2t5IC0gbWFrZSB0aGlzIHZpc2l0b3IgZmVlbCB3ZWxjb21lIGFuZCBpbmZvcm1lZCFgO1xyXG5cclxuICAgIGNvbnN0IGlucHV0ID0ge1xyXG4gICAgICBpbnB1dDogeyB0ZXh0OiBzeXN0ZW1Qcm9tcHQgfSxcclxuICAgICAgcmV0cmlldmVBbmRHZW5lcmF0ZUNvbmZpZ3VyYXRpb246IHtcclxuICAgICAgICB0eXBlOiBcIktOT1dMRURHRV9CQVNFXCIgYXMgY29uc3QsXHJcbiAgICAgICAga25vd2xlZGdlQmFzZUNvbmZpZ3VyYXRpb246IHtcclxuICAgICAgICAgIGtub3dsZWRnZUJhc2VJZDogcHJvY2Vzcy5lbnYuS05PV0xFREdFX0JBU0VfSUQsXHJcbiAgICAgICAgICBtb2RlbEFybjogXCJhcm46YXdzOmJlZHJvY2s6dXMtZWFzdC0xOjpmb3VuZGF0aW9uLW1vZGVsL2FtYXpvbi5ub3ZhLXByby12MTowXCIsXHJcbiAgICAgICAgICBnZW5lcmF0aW9uQ29uZmlndXJhdGlvbjoge1xyXG4gICAgICAgICAgICBpbmZlcmVuY2VDb25maWc6IHtcclxuICAgICAgICAgICAgICB0ZXh0SW5mZXJlbmNlQ29uZmlnOiB7XHJcbiAgICAgICAgICAgICAgICB0ZW1wZXJhdHVyZTogMC40NSwgIC8vIFNsaWdodGx5IGhpZ2hlciBmb3IgZnJpZW5kbGllciwgbW9yZSBuYXR1cmFsIHJlc3BvbnNlc1xyXG4gICAgICAgICAgICAgICAgdG9wUDogMC45LFxyXG4gICAgICAgICAgICAgICAgbWF4VG9rZW5zOiAyNTAwXHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBzZXNzaW9uSWQ6IGV2ZW50LnNlc3Npb25JZFxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBjb21tYW5kID0gbmV3IFJldHJpZXZlQW5kR2VuZXJhdGVDb21tYW5kKGlucHV0KTtcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2xpZW50LnNlbmQoY29tbWFuZCk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3RhdHVzQ29kZTogMjAwLFxyXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgYW5zd2VyOiByZXNwb25zZS5vdXRwdXQ/LnRleHQsXHJcbiAgICAgICAgY2l0YXRpb25zOiByZXNwb25zZS5jaXRhdGlvbnMsXHJcbiAgICAgICAgc2Vzc2lvbklkOiByZXNwb25zZS5zZXNzaW9uSWRcclxuICAgICAgfSlcclxuICAgIH07XHJcbiAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvcjpcIiwgZXJyb3IpO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3RhdHVzQ29kZTogNTAwLFxyXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IFxyXG4gICAgICAgIGVycm9yOiBcIk9vcHMhIEhhZCB0cm91YmxlIGFjY2Vzc2luZyB0aGUgYnVpbGRpbmcgaW5mby4gVHJ5IGFnYWluIG9yIGNvbnRhY3QgYmFoMTItcmVjZXB0aW9uQGFtYXpvbi5jb21cIlxyXG4gICAgICB9KVxyXG4gICAgfTtcclxuICB9XHJcbn07Il19