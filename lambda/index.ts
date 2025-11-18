import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } from "@aws-sdk/client-bedrock-agent-runtime";

const client = new BedrockAgentRuntimeClient({ 
  region: "us-east-1" ,
  requestHandler: {
    requestTimeout: 50000 
  }});

export const handler = async (event: any) => {
  try {
    const question = event.question?.trim() || "Provide a comprehensive summary of the main topics and key information available in this knowledge base.";
    const knowledgeBaseId = process.env.KNOWLEDGE_BASE_ID;

    const input = {
      input: {
        text: question
      },
      retrieveAndGenerateConfiguration: {
        type: "KNOWLEDGE_BASE" as const,
        knowledgeBaseConfiguration: {
          knowledgeBaseId: knowledgeBaseId,
          modelArn: "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0"
        }
      }
    };

    const command = new RetrieveAndGenerateCommand(input);
    const response = await client.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({
        answer: response.output?.text
            })
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Failed to query Knowledge Base"
      })
    };
  }
};



// import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

// const client = new BedrockRuntimeClient({ region: "us-east-1" });

// export const handler = async (event: any) => {
//   try {
//     const prompt = event.prompt || "Hello, how are you?";

//     const input = {
//       modelId: "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0",
//       contentType: "application/json",
//       accept: "application/json",
//       body: JSON.stringify({
//         schemaVersion: "messages-v1",
//         messages: [
//           { 
//             role: "user", 
//             content: [
//               { text: prompt }
//             ]
//           }
//         ],
//         inferenceConfig: {
//           max_new_tokens: 1000,
//           temperature: 0.7
//         }
//       })
//     };

//     const command = new InvokeModelCommand(input);
//     const response = await client.send(command);
    
//     const responseBody = JSON.parse(new TextDecoder().decode(response.body));

//     return {
//       statusCode: 200,
//       body: JSON.stringify({
//         message: responseBody.output?.message?.content?.[0]?.text || "No response"
//       })
//     };
//   } catch (error) {
//     console.error("Error:", error);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({ 
//         error: "Failed to invoke Bedrock",
//         details: error instanceof Error ? error.message : String(error)
//       })
//     };
//   }
// };

