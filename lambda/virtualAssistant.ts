import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand , UpdateCommand} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from 'crypto';

const client = new BedrockAgentRuntimeClient({ 
  region: "us-east-1",
  requestHandler: {
    requestTimeout: 50000 
  }
});



const ddbClient = new DynamoDBClient({ region: "us-east-1" });
const ddb = DynamoDBDocumentClient.from(ddbClient);

export const handler = async (event: any) => {
  try {
    //const userQuestion = event.body ? JSON.parse(event.body).question?.trim() : event.question?.trim();
    const body = event.body ? JSON.parse(event.body) : event;
    const userQuestion = body.question?.trim();
    let sessionId = body.sessionId;

    if (!sessionId) {
      sessionId = randomUUID(); 
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
      const result = await ddb.send(new QueryCommand({
        TableName: process.env.TABLE_NAME!,
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
    } catch (err) {
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
                maxTokens: 10000
              }
            }
          }
        }
      },
      //sessionId: event.sessionId
    };

    const command = new RetrieveAndGenerateCommand(input);
    const response = await client.send(command);

    await ddb.send(new UpdateCommand({
      TableName: process.env.TABLE_NAME!,
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