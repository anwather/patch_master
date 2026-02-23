import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

async function healthHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const headers: Record<string, string> = {};
  for (const [key, value] of req.headers.entries()) {
    if (key.startsWith("x-ms-")) {
      headers[key] = key.includes("token") ? `${value.substring(0, 20)}...` : value;
    }
  }

  return {
    jsonBody: {
      ok: true,
      timestamp: new Date().toISOString(),
      swaHeaders: headers,
      env: {
        hasClientId: !!process.env.AZURE_CLIENT_ID,
        hasClientSecret: !!process.env.AZURE_CLIENT_SECRET,
        hasTenantId: !!process.env.AZURE_TENANT_ID,
        demoMode: process.env.DEMO_MODE
      }
    }
  };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: healthHandler
});
