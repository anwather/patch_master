import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getAuthUser, getArmToken } from "../shared/auth.js";
import { listServersForUser } from "../shared/arm.js";

async function serversHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const user = getAuthUser(req);
  if (!user) {
    return { status: 401, jsonBody: { error: "Unauthorized" } };
  }

  try {
    const showEnabledOnly = req.query.get("showEnabledOnly") !== "false";
    context.log(`User: ${user.name}, acquiring ARM token via OBO flow`);

    const armToken = await getArmToken(req);
    context.log(`ARM token acquired: ${!!armToken}`);

    const all = await listServersForUser(user, armToken);
    const filtered = showEnabledOnly ? all.filter((s) => s.isUpdateManagerEnabled) : all;

    return {
      jsonBody: { showEnabledOnly, servers: filtered }
    };
  } catch (error) {
    context.error("Server enumeration failed:", error);
    return {
      status: 502,
      jsonBody: {
        error: "Failed to enumerate Azure servers for this user.",
        details: (error as Error).message
      }
    };
  }
}

app.http("servers", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "servers",
  handler: serversHandler
});
