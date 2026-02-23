import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getAuthUser } from "../shared/auth.js";
import { buildTerraform } from "../shared/terraform.js";
import { TerraformInput } from "../shared/types.js";

async function terraformHandler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const user = getAuthUser(req);
  if (!user) {
    return { status: 401, jsonBody: { error: "Unauthorized" } };
  }

  const body = (await req.json()) as TerraformInput;
  const input: TerraformInput = {
    ...body,
    selectedServerIds: Array.isArray(body.selectedServerIds)
      ? body.selectedServerIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : []
  };
  const terraform = buildTerraform(input);

  return { jsonBody: { terraform } };
}

app.http("terraform", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "terraform",
  handler: terraformHandler
});
