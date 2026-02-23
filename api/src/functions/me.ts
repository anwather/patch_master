import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getAuthUser } from "../shared/auth.js";

async function meHandler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const user = getAuthUser(req);
  if (!user) {
    return { status: 401, jsonBody: { error: "Unauthorized" } };
  }
  return { jsonBody: user };
}

app.http("me", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "me",
  handler: meHandler
});
