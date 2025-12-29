const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN || "http://localhost:5173";

export const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
};

export function jsonResponse(
  statusCode: number,
  body: any,
  extraHeaders: Record<string, string> = {}
) {
  return {
    statusCode,
    headers: {
      ...BASE_CORS_HEADERS,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}
