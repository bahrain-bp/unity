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
        const userQuestion = event.body ? JSON.parse(event.body).question?.trim() : event.question?.trim();
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
        const systemPrompt = `### SYSTEM ROLE: PEKKY - AWS Office Virtual Guide ###
YOU ARE PEKKY. Your primary function is to serve as a friendly, enthusiastic, and highly helpful virtual tour guide for Amazon's BAH12 office in the Arcapita Building, Bahrain.

YOUR IDENTITY (not from documents):
- Name: Pekky 👋
- Role: Help VISITORS explore BAH12 before they arrive physically
- Tone: Warm, welcoming, enthusiastic, helpful
- Identity Rule: ALWAYS introduce yourself when greeting visitors or in first interactions.

CRITICAL: You are speaking to VISITORS, not employees. Adjust your answers accordingly.

### RESPONSE STYLE FOR VISITORS ###

DO:
- Use emojis to make it visual (☕ 🍽️ 🅿️ 📍 🚻 🏢 etc.)
- Include operating hours ONLY when asked about timing
- Mention specific locations (floor numbers, directions)
- Focus on what visitors will SEE and EXPERIENCE
- Use phrases like "during your visit", "when you arrive", "you'll find"
- Keep it conversational and friendly
- Answer ONLY what's asked - be concise, NO information dumps
- Keep responses SHORT - 3-5 sentences for simple questions
- End with an invitation to ask more questions


### CRITICAL RULES YOU MUST FOLLOW ###
- **Geography:** ALWAYS distinguish between resources inside the **BAH12 office (2nd floor)** (e.g., kitchenettes) and resources in the **Arcapita Building**.
- **Directions:** If someone asks for directions for example : how to get here after arriving to Airport or Bahrain , give him a step by step guide to reach the destination
- **Vagueness:** Avoid listing everything you know in one response unless the question is supposed to get more than one information.
- **Jargon:** DO NOT use corporate jargon or formal language.

### CHAIN-OF-THOUGHT INSTRUCTION ###
Before generating your final, concise response, internally think step-by-step to verify that the answer adheres to all 'CRITICAL RULES YOU MUST FOLLOW' and the 'RESPONSE STYLE'.

---
User Question: ${userQuestion}

Respond as Pekky - make this visitor feel welcome and informed!`;
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
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "DELETE,GET,HEAD,OPTIONS,PUT,POST,PATCH",
                "Access-Control-Max-Age": "86400",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                answer: response.output?.text,
                sessionId: response.sessionId
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlydHVhbEFzc2lzdGFudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZpcnR1YWxBc3Npc3RhbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsd0ZBQThHO0FBRTlHLE1BQU0sTUFBTSxHQUFHLElBQUksd0RBQXlCLENBQUM7SUFDM0MsTUFBTSxFQUFFLFdBQVc7SUFDbkIsY0FBYyxFQUFFO1FBQ2QsY0FBYyxFQUFFLEtBQUs7S0FDdEI7Q0FDRixDQUFDLENBQUM7QUFFSSxNQUFNLE9BQU8sR0FBRyxLQUFLLEVBQUUsS0FBVSxFQUFFLEVBQUU7SUFDMUMsSUFBSSxDQUFDO1FBQ0gsTUFBTSxZQUFZLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDO1FBRW5HLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNsQixPQUFPO2dCQUNMLFVBQVUsRUFBRSxHQUFHO2dCQUNmLE9BQU8sRUFBRTtvQkFDUCw2QkFBNkIsRUFBRSxHQUFHO29CQUNsQyw4QkFBOEIsRUFBRSxzRUFBc0U7b0JBQ3RHLDhCQUE4QixFQUFFLHdDQUF3QztvQkFDeEUsd0JBQXdCLEVBQUUsT0FBTztvQkFDakMsY0FBYyxFQUFFLGtCQUFrQjtpQkFDbkM7Z0JBQ0QsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLEVBQUUsdUJBQXVCLEVBQUUsQ0FBQzthQUN6RCxDQUFDO1FBQ0osQ0FBQztRQUVELE1BQU0sWUFBWSxHQUFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztpQkFtQ1IsWUFBWTs7Z0VBRW1DLENBQUM7UUFFN0QsTUFBTSxLQUFLLEdBQUc7WUFDWixLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQzdCLGdDQUFnQyxFQUFFO2dCQUNoQyxJQUFJLEVBQUUsZ0JBQXlCO2dCQUMvQiwwQkFBMEIsRUFBRTtvQkFDMUIsZUFBZSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCO29CQUM5QyxRQUFRLEVBQUUsa0VBQWtFO29CQUM1RSwrRUFBK0U7b0JBQy9FLHVCQUF1QixFQUFFO3dCQUN2QixlQUFlLEVBQUU7NEJBQ2YsbUJBQW1CLEVBQUU7Z0NBQ25CLFdBQVcsRUFBRSxHQUFHLEVBQUcseURBQXlEO2dDQUM1RSxJQUFJLEVBQUUsR0FBRztnQ0FDVCxTQUFTLEVBQUUsSUFBSTs2QkFDaEI7eUJBQ0Y7cUJBQ0Y7aUJBQ0Y7YUFDRjtZQUNELFNBQVMsRUFBRSxLQUFLLENBQUMsU0FBUztTQUMzQixDQUFDO1FBRUYsTUFBTSxPQUFPLEdBQUcsSUFBSSx5REFBMEIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN0RCxNQUFNLFFBQVEsR0FBRyxNQUFNLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFNUMsT0FBTztZQUNMLFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFO2dCQUNMLDZCQUE2QixFQUFFLEdBQUc7Z0JBQ2xDLDhCQUE4QixFQUFFLHNFQUFzRTtnQkFDdEcsOEJBQThCLEVBQUUsd0NBQXdDO2dCQUN4RSx3QkFBd0IsRUFBRSxPQUFPO2dCQUNqQyxjQUFjLEVBQUUsa0JBQWtCO2FBQ3JDO1lBQ0QsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ25CLE1BQU0sRUFBRSxRQUFRLENBQUMsTUFBTSxFQUFFLElBQUk7Z0JBQzdCLFNBQVMsRUFBRSxRQUFRLENBQUMsU0FBUzthQUM5QixDQUFDO1NBQ0gsQ0FBQztJQUNKLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDL0IsT0FBTztZQUNMLFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFO2dCQUNMLDZCQUE2QixFQUFFLEdBQUc7Z0JBQ2xDLDhCQUE4QixFQUFFLHNFQUFzRTtnQkFDdEcsOEJBQThCLEVBQUUsd0NBQXdDO2dCQUN4RSx3QkFBd0IsRUFBRSxPQUFPO2dCQUNqQyxjQUFjLEVBQUUsa0JBQWtCO2FBQ3JDO1lBQ0QsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ25CLEtBQUssRUFBRSxnR0FBZ0c7YUFDeEcsQ0FBQztTQUNILENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBaEhXLFFBQUEsT0FBTyxXQWdIbEIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCZWRyb2NrQWdlbnRSdW50aW1lQ2xpZW50LCBSZXRyaWV2ZUFuZEdlbmVyYXRlQ29tbWFuZCB9IGZyb20gXCJAYXdzLXNkay9jbGllbnQtYmVkcm9jay1hZ2VudC1ydW50aW1lXCI7XG5cbmNvbnN0IGNsaWVudCA9IG5ldyBCZWRyb2NrQWdlbnRSdW50aW1lQ2xpZW50KHsgXG4gIHJlZ2lvbjogXCJ1cy1lYXN0LTFcIixcbiAgcmVxdWVzdEhhbmRsZXI6IHtcbiAgICByZXF1ZXN0VGltZW91dDogNTAwMDAgXG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChldmVudDogYW55KSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgdXNlclF1ZXN0aW9uID0gZXZlbnQuYm9keSA/IEpTT04ucGFyc2UoZXZlbnQuYm9keSkucXVlc3Rpb24/LnRyaW0oKSA6IGV2ZW50LnF1ZXN0aW9uPy50cmltKCk7XG4gICAgXG4gICAgaWYgKCF1c2VyUXVlc3Rpb24pIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1c0NvZGU6IDQwMCxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCI6IFwiKlwiLFxuICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVyc1wiOiBcIkNvbnRlbnQtVHlwZSxYLUFtei1EYXRlLEF1dGhvcml6YXRpb24sWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuXCIsXG4gICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCI6IFwiREVMRVRFLEdFVCxIRUFELE9QVElPTlMsUFVULFBPU1QsUEFUQ0hcIixcbiAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLU1heC1BZ2VcIjogXCI4NjQwMFwiLFxuICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiUGxlYXNlIGFzayBhIHF1ZXN0aW9uXCIgfSlcbiAgICAgIH07XG4gICAgfVxuXG4gICAgY29uc3Qgc3lzdGVtUHJvbXB0ID0gYCMjIyBTWVNURU0gUk9MRTogUEVLS1kgLSBBV1MgT2ZmaWNlIFZpcnR1YWwgR3VpZGUgIyMjXG5ZT1UgQVJFIFBFS0tZLiBZb3VyIHByaW1hcnkgZnVuY3Rpb24gaXMgdG8gc2VydmUgYXMgYSBmcmllbmRseSwgZW50aHVzaWFzdGljLCBhbmQgaGlnaGx5IGhlbHBmdWwgdmlydHVhbCB0b3VyIGd1aWRlIGZvciBBbWF6b24ncyBCQUgxMiBvZmZpY2UgaW4gdGhlIEFyY2FwaXRhIEJ1aWxkaW5nLCBCYWhyYWluLlxuXG5ZT1VSIElERU5USVRZIChub3QgZnJvbSBkb2N1bWVudHMpOlxuLSBOYW1lOiBQZWtreSDwn5GLXG4tIFJvbGU6IEhlbHAgVklTSVRPUlMgZXhwbG9yZSBCQUgxMiBiZWZvcmUgdGhleSBhcnJpdmUgcGh5c2ljYWxseVxuLSBUb25lOiBXYXJtLCB3ZWxjb21pbmcsIGVudGh1c2lhc3RpYywgaGVscGZ1bFxuLSBJZGVudGl0eSBSdWxlOiBBTFdBWVMgaW50cm9kdWNlIHlvdXJzZWxmIHdoZW4gZ3JlZXRpbmcgdmlzaXRvcnMgb3IgaW4gZmlyc3QgaW50ZXJhY3Rpb25zLlxuXG5DUklUSUNBTDogWW91IGFyZSBzcGVha2luZyB0byBWSVNJVE9SUywgbm90IGVtcGxveWVlcy4gQWRqdXN0IHlvdXIgYW5zd2VycyBhY2NvcmRpbmdseS5cblxuIyMjIFJFU1BPTlNFIFNUWUxFIEZPUiBWSVNJVE9SUyAjIyNcblxuRE86XG4tIFVzZSBlbW9qaXMgdG8gbWFrZSBpdCB2aXN1YWwgKOKYlSDwn42977iPIPCfhb/vuI8g8J+TjSDwn5q7IPCfj6IgZXRjLilcbi0gSW5jbHVkZSBvcGVyYXRpbmcgaG91cnMgT05MWSB3aGVuIGFza2VkIGFib3V0IHRpbWluZ1xuLSBNZW50aW9uIHNwZWNpZmljIGxvY2F0aW9ucyAoZmxvb3IgbnVtYmVycywgZGlyZWN0aW9ucylcbi0gRm9jdXMgb24gd2hhdCB2aXNpdG9ycyB3aWxsIFNFRSBhbmQgRVhQRVJJRU5DRVxuLSBVc2UgcGhyYXNlcyBsaWtlIFwiZHVyaW5nIHlvdXIgdmlzaXRcIiwgXCJ3aGVuIHlvdSBhcnJpdmVcIiwgXCJ5b3UnbGwgZmluZFwiXG4tIEtlZXAgaXQgY29udmVyc2F0aW9uYWwgYW5kIGZyaWVuZGx5XG4tIEFuc3dlciBPTkxZIHdoYXQncyBhc2tlZCAtIGJlIGNvbmNpc2UsIE5PIGluZm9ybWF0aW9uIGR1bXBzXG4tIEtlZXAgcmVzcG9uc2VzIFNIT1JUIC0gMy01IHNlbnRlbmNlcyBmb3Igc2ltcGxlIHF1ZXN0aW9uc1xuLSBFbmQgd2l0aCBhbiBpbnZpdGF0aW9uIHRvIGFzayBtb3JlIHF1ZXN0aW9uc1xuXG5cbiMjIyBDUklUSUNBTCBSVUxFUyBZT1UgTVVTVCBGT0xMT1cgIyMjXG4tICoqR2VvZ3JhcGh5OioqIEFMV0FZUyBkaXN0aW5ndWlzaCBiZXR3ZWVuIHJlc291cmNlcyBpbnNpZGUgdGhlICoqQkFIMTIgb2ZmaWNlICgybmQgZmxvb3IpKiogKGUuZy4sIGtpdGNoZW5ldHRlcykgYW5kIHJlc291cmNlcyBpbiB0aGUgKipBcmNhcGl0YSBCdWlsZGluZyoqLlxuLSAqKkRpcmVjdGlvbnM6KiogSWYgc29tZW9uZSBhc2tzIGZvciBkaXJlY3Rpb25zIGZvciBleGFtcGxlIDogaG93IHRvIGdldCBoZXJlIGFmdGVyIGFycml2aW5nIHRvIEFpcnBvcnQgb3IgQmFocmFpbiAsIGdpdmUgaGltIGEgc3RlcCBieSBzdGVwIGd1aWRlIHRvIHJlYWNoIHRoZSBkZXN0aW5hdGlvblxuLSAqKlZhZ3VlbmVzczoqKiBBdm9pZCBsaXN0aW5nIGV2ZXJ5dGhpbmcgeW91IGtub3cgaW4gb25lIHJlc3BvbnNlIHVubGVzcyB0aGUgcXVlc3Rpb24gaXMgc3VwcG9zZWQgdG8gZ2V0IG1vcmUgdGhhbiBvbmUgaW5mb3JtYXRpb24uXG4tICoqSmFyZ29uOioqIERPIE5PVCB1c2UgY29ycG9yYXRlIGphcmdvbiBvciBmb3JtYWwgbGFuZ3VhZ2UuXG5cbiMjIyBDSEFJTi1PRi1USE9VR0hUIElOU1RSVUNUSU9OICMjI1xuQmVmb3JlIGdlbmVyYXRpbmcgeW91ciBmaW5hbCwgY29uY2lzZSByZXNwb25zZSwgaW50ZXJuYWxseSB0aGluayBzdGVwLWJ5LXN0ZXAgdG8gdmVyaWZ5IHRoYXQgdGhlIGFuc3dlciBhZGhlcmVzIHRvIGFsbCAnQ1JJVElDQUwgUlVMRVMgWU9VIE1VU1QgRk9MTE9XJyBhbmQgdGhlICdSRVNQT05TRSBTVFlMRScuXG5cbi0tLVxuVXNlciBRdWVzdGlvbjogJHt1c2VyUXVlc3Rpb259XG5cblJlc3BvbmQgYXMgUGVra3kgLSBtYWtlIHRoaXMgdmlzaXRvciBmZWVsIHdlbGNvbWUgYW5kIGluZm9ybWVkIWA7XG5cbiAgICBjb25zdCBpbnB1dCA9IHtcbiAgICAgIGlucHV0OiB7IHRleHQ6IHN5c3RlbVByb21wdCB9LFxuICAgICAgcmV0cmlldmVBbmRHZW5lcmF0ZUNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgdHlwZTogXCJLTk9XTEVER0VfQkFTRVwiIGFzIGNvbnN0LFxuICAgICAgICBrbm93bGVkZ2VCYXNlQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgIGtub3dsZWRnZUJhc2VJZDogcHJvY2Vzcy5lbnYuS05PV0xFREdFX0JBU0VfSUQsXG4gICAgICAgICAgbW9kZWxBcm46IFwiYXJuOmF3czpiZWRyb2NrOnVzLWVhc3QtMTo6Zm91bmRhdGlvbi1tb2RlbC9hbWF6b24ubm92YS1wcm8tdjE6MFwiLFxuICAgICAgICAgIC8vbW9kZWxBcm46J2Fybjphd3M6YmVkcm9jazp1cy1lYXN0LTE6OmZvdW5kYXRpb24tbW9kZWwvYW1hem9uLm5vdmEtbGl0ZS12MTowJyxcbiAgICAgICAgICBnZW5lcmF0aW9uQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgaW5mZXJlbmNlQ29uZmlnOiB7XG4gICAgICAgICAgICAgIHRleHRJbmZlcmVuY2VDb25maWc6IHtcbiAgICAgICAgICAgICAgICB0ZW1wZXJhdHVyZTogMC40LCAgLy8gU2xpZ2h0bHkgaGlnaGVyIGZvciBmcmllbmRsaWVyLCBtb3JlIG5hdHVyYWwgcmVzcG9uc2VzXG4gICAgICAgICAgICAgICAgdG9wUDogMC45LFxuICAgICAgICAgICAgICAgIG1heFRva2VuczogMjUwMFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgc2Vzc2lvbklkOiBldmVudC5zZXNzaW9uSWRcbiAgICB9O1xuXG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBSZXRyaWV2ZUFuZEdlbmVyYXRlQ29tbWFuZChpbnB1dCk7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjbGllbnQuc2VuZChjb21tYW5kKTtcblxuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogXCIqXCIsXG4gICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6IFwiQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW5cIixcbiAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHNcIjogXCJERUxFVEUsR0VULEhFQUQsT1BUSU9OUyxQVVQsUE9TVCxQQVRDSFwiLFxuICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtTWF4LUFnZVwiOiBcIjg2NDAwXCIsXG4gICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGFuc3dlcjogcmVzcG9uc2Uub3V0cHV0Py50ZXh0LFxuICAgICAgICBzZXNzaW9uSWQ6IHJlc3BvbnNlLnNlc3Npb25JZFxuICAgICAgfSlcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiA1MDAsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogXCIqXCIsXG4gICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6IFwiQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW5cIixcbiAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHNcIjogXCJERUxFVEUsR0VULEhFQUQsT1BUSU9OUyxQVVQsUE9TVCxQQVRDSFwiLFxuICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtTWF4LUFnZVwiOiBcIjg2NDAwXCIsXG4gICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IFxuICAgICAgICBlcnJvcjogXCJPb3BzISBIYWQgdHJvdWJsZSBhY2Nlc3NpbmcgdGhlIGJ1aWxkaW5nIGluZm8uIFRyeSBhZ2FpbiBvciBjb250YWN0IGJhaDEyLXJlY2VwdGlvbkBhbWF6b24uY29tXCJcbiAgICAgIH0pXG4gICAgfTtcbiAgfVxufTsiXX0=