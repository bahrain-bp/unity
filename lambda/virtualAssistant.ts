import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } from "@aws-sdk/client-bedrock-agent-runtime";

const client = new BedrockAgentRuntimeClient({ 
  region: "us-east-1",
  requestHandler: {
    requestTimeout: 50000 
  }
});

export const handler = async (event: any) => {
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
        type: "KNOWLEDGE_BASE" as const,
        knowledgeBaseConfiguration: {
          knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
          modelArn: "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0",
          generationConfiguration: {
            inferenceConfig: {
              textInferenceConfig: {
                temperature: 0.45,  // Slightly higher for friendlier, more natural responses
                topP: 0.9,
                maxTokens: 2500
              }
            }
          }
        }
      },
      sessionId: event.sessionId
    };

    const command = new RetrieveAndGenerateCommand(input);
    const response = await client.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({
        answer: response.output?.text,
        citations: response.citations,
        sessionId: response.sessionId
      })
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Oops! Had trouble accessing the building info. Try again or contact bah12-reception@amazon.com"
      })
    };
  }
};