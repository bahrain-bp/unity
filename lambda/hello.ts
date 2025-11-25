export const handler = async (event: any) => {
  console.log("event", JSON.stringify(event, null, 2));

  // Claims from Cognito authorizer
  const claims = event.requestContext?.authorizer?.claims || {};
  const email = claims.email;
  const sub = claims.sub;

  const responseBody = {
    message: "Hello from Unity API!",
    user: {
      sub,
      email,
    },
  };

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      // CORS for browser
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
    },
    body: JSON.stringify(responseBody),
  };
};
