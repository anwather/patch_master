import { HttpRequest } from "@azure/functions";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { AuthUser } from "./types.js";

export function decodeClientPrincipal(header: string): AuthUser | null {
  try {
    const decoded = Buffer.from(header, "base64").toString("utf8");
    const principal = JSON.parse(decoded) as {
      userDetails?: string;
      claims?: Array<{ typ: string; val: string }>;
    };
    const claims = principal.claims ?? [];
    const find = (type: string) => claims.find((c) => c.typ === type)?.val;
    return {
      name: principal.userDetails ?? "unknown",
      objectId: find("http://schemas.microsoft.com/identity/claims/objectidentifier"),
      tenantId: find("http://schemas.microsoft.com/identity/claims/tenantid")
    };
  } catch {
    return null;
  }
}

export function getAuthUser(req: HttpRequest): AuthUser | null {
  const clientPrincipal = req.headers.get("x-ms-client-principal");
  if (clientPrincipal) {
    return decodeClientPrincipal(clientPrincipal);
  }
  const demoMode = process.env.DEMO_MODE === "true";
  if (demoMode) {
    return { name: "demo-anonymous-user" };
  }
  return null;
}

/**
 * Get ARM access token. Checks multiple sources:
 * 1. X-ARM-Token header (sent by frontend MSAL.js)
 * 2. x-ms-token-aad-access-token (SWA token store, if available)
 * 3. OBO flow with id token (fallback)
 */
export async function getArmToken(req: HttpRequest): Promise<string | null> {
  // Frontend MSAL.js sends ARM token in custom header
  const frontendToken = req.headers.get("x-arm-token");
  if (frontendToken) {
    return frontendToken;
  }

  // SWA token store (may not be available for managed functions)
  const directToken = req.headers.get("x-ms-token-aad-access-token");
  if (directToken) {
    return directToken;
  }

  // Fallback: OBO with id token
  const idToken = req.headers.get("x-ms-token-aad-id-token");
  if (!idToken) {
    return null;
  }

  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    return null;
  }

  const cca = new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`
    }
  });

  try {
    const result = await cca.acquireTokenOnBehalfOf({
      oboAssertion: idToken,
      scopes: ["https://management.azure.com/user_impersonation"]
    });
    return result?.accessToken ?? null;
  } catch (err) {
    console.error("OBO token acquisition failed:", err);
    return null;
  }
}
