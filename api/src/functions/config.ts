import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getAuthUser } from "../shared/auth.js";

async function configHandler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const demoMode = process.env.DEMO_MODE === "true";
  const user = getAuthUser(req);

  return {
    jsonBody: {
      demoMode,
      localEntraEnabled: false,
      loginUrl: "/.auth/login/aad",
      logoutUrl: "/.auth/logout",
      entraClientId: process.env.AZURE_CLIENT_ID || null,
      entraTenantId: process.env.AZURE_TENANT_ID || null,
      user
    }
  };
}

app.http("config", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "config",
  handler: configHandler
});
