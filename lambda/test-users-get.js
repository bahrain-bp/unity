// Mock API Gateway event for testing
const mockEvent = {
  httpMethod: "GET",
  requestContext: {
    authorizer: {
      claims: {
        "cognito:groups": ["admin"]  // Test as admin user
      }
    }
  }
};

// Mock environment variables
process.env.USER_POOL_ID = "us-east-1_TESTPOOL";  // Replace with real pool ID if you have it

// Import and test your function
async function testLocally() {
  console.log("🧪 Testing users-get Lambda locally...\n");
  
  try {
    // Compile TypeScript to JavaScript first
    const { handler } = require('./users-get');
    
    console.log("📝 Mock Event:", JSON.stringify(mockEvent, null, 2));
    console.log("\n⏳ Calling handler...\n");
    
    const result = await handler(mockEvent);
    
    console.log("✅ Success!");
    console.log("Status Code:", result.statusCode);
    console.log("Response:", JSON.stringify(JSON.parse(result.body), null, 2));
  } catch (error) {
    console.log("❌ Error:", error.message);
    console.log("Stack:", error.stack);
  }
}

testLocally();
