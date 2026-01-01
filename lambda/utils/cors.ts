const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://127.0.0.1:5173"

export const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
}

export const createResponse = (statusCode: number, body: any, extraHeaders: Record<string,string> = {}) => ({
  statusCode,
  headers: { ...CORS_HEADERS, ...extraHeaders },
  body: JSON.stringify(body),
})

export const createErrorResponse = (statusCode: number, error: string) =>
  createResponse(statusCode, { error })
