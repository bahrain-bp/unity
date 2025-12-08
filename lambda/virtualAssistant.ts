import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } from "@aws-sdk/client-bedrock-agent-runtime";

const client = new BedrockAgentRuntimeClient({ 
  region: "us-east-1",
  requestHandler: {
    requestTimeout: 50000 
  }
});

export const handler = async (event: any) => {
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
        type: "KNOWLEDGE_BASE" as const,
        knowledgeBaseConfiguration: {
          knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
          modelArn: "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0",
          //modelArn:'arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0',
          generationConfiguration: {
            inferenceConfig: {
              textInferenceConfig: {
                temperature: 0.4,  // Slightly higher for friendlier, more natural responses
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
  } catch (error) {
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