export const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export const createResponse = (statusCode: number, body: any) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

export const createErrorResponse = (statusCode: number, error: string) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify({ error }),
});
