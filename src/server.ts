import express, { Request, Response } from "express";
import session from "express-session";
import crypto from "node:crypto";
import { config as loadEnv } from "dotenv";
import path from "node:path";

type AuthUser = {
  name: string;
  tenantId?: string;
  objectId?: string;
};

type ServerItem = {
  id: string;
  name: string;
  resourceGroup: string;
  subscriptionId: string;
  subscriptionName: string;
  osType: "Windows" | "Linux";
  isUpdateManagerEnabled: boolean;
};

type EntraAuthResult = {
  user: AuthUser;
  armAccessToken: string;
};

type TerraformInput = {
  name: string;
  resourceGroupName: string;
  location: string;
  inGuestUserPatchMode: "Platform" | "User";
  startDateTime: string;
  timeZone: string;
  recurEvery?: string;
  duration?: string;
  reboot: "Always" | "IfRequired" | "Never";
  selectedServerIds?: string[];
  windowsClassifications?: string[];
  linuxClassifications?: string[];
};

loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv();

const app = express();
const port = Number(process.env.PORT ?? 3000);
const publicDir = path.join(process.cwd(), "public");
const demoMode = process.env.DEMO_MODE === "true";
const localEntraEnabled = process.env.LOCAL_ENTRA_AUTH === "true";
const tenantId = process.env.ENTRA_TENANT_ID;
const clientId = process.env.ENTRA_CLIENT_ID;
const clientSecret = process.env.ENTRA_CLIENT_SECRET;
const redirectUri = process.env.ENTRA_REDIRECT_URI ?? `http://localhost:${port}/auth/callback`;
const sessionSecret = process.env.SESSION_SECRET ?? "patch-master-dev-session-secret";
const armScope = process.env.ARM_SCOPE ?? "https://management.azure.com/user_impersonation";

declare module "express-session" {
  interface SessionData {
    authState?: string;
    authUser?: AuthUser;
    armAccessToken?: string;
  }
}

app.use(express.json());
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: false }
  })
);
app.use(express.static(publicDir));

function decodeClientPrincipal(header: string): AuthUser | null {
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

function getAuthUser(req: Request): AuthUser | null {
  const clientPrincipal = req.header("x-ms-client-principal");
  if (clientPrincipal) {
    return decodeClientPrincipal(clientPrincipal);
  }
  if (req.session.authUser) {
    return req.session.authUser;
  }
  if (!localEntraEnabled && process.env.NODE_ENV !== "production") {
    return {
      name: "local-dev-user",
      tenantId: "local-tenant",
      objectId: "local-object-id"
    };
  }
  return null;
}

function requireAuth(req: Request, res: Response): AuthUser | undefined {
  const user = getAuthUser(req);
  if (!user) {
    if (demoMode) {
      return { name: "demo-anonymous-user" };
    }
    res.status(401).json({
      error: "Unauthorized. Sign in to continue.",
      loginUrl: localEntraEnabled ? "/auth/login" : "/.auth/login/aad"
    });
    return undefined;
  }
  return user;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split(".")[1] ?? "";
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
}

function hasLocalEntraConfig(): boolean {
  return Boolean(localEntraEnabled && tenantId && clientId && clientSecret);
}

async function exchangeCodeForUser(code: string): Promise<EntraAuthResult> {
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing Entra configuration.");
  }
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: `openid profile email ${armScope}`
  });
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }
  const tokenJson = (await response.json()) as { id_token?: string; access_token?: string };
  if (!tokenJson.id_token || !tokenJson.access_token) {
    throw new Error("Missing id_token or access_token in Entra response.");
  }
  const claims = decodeJwtPayload(tokenJson.id_token);
  return {
    user: {
      name: String(claims.name ?? claims.preferred_username ?? "entra-user"),
      tenantId: String(claims.tid ?? ""),
      objectId: String(claims.oid ?? "")
    },
    armAccessToken: tokenJson.access_token
  };
}

async function armGetAll<T extends object>(url: string, accessToken: string): Promise<T[]> {
  const collected: T[] = [];
  let nextUrl: string | undefined = url;
  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ARM request failed (${response.status}): ${text}`);
    }
    const payload = (await response.json()) as { value?: T[]; nextLink?: string };
    collected.push(...(payload.value ?? []));
    nextUrl = payload.nextLink;
  }
  return collected;
}

function resourceGroupFromId(resourceId: string): string {
  const match = resourceId.match(/\/resourceGroups\/([^/]+)/i);
  return match?.[1] ?? "unknown-rg";
}

async function listServersForUser(_user: AuthUser, armAccessToken?: string): Promise<ServerItem[]> {
  if (!armAccessToken) {
    // Fallback for demo mode / local dev mode without delegated ARM token.
    return [
      {
        id: "/subscriptions/000/resourceGroups/rg-app/providers/Microsoft.Compute/virtualMachines/app-01",
        name: "app-01",
        resourceGroup: "rg-app",
        subscriptionId: "000",
        subscriptionName: "Demo Subscription",
        osType: "Windows",
        isUpdateManagerEnabled: true
      },
      {
        id: "/subscriptions/000/resourceGroups/rg-data/providers/Microsoft.Compute/virtualMachines/data-01",
        name: "data-01",
        resourceGroup: "rg-data",
        subscriptionId: "000",
        subscriptionName: "Demo Subscription",
        osType: "Linux",
        isUpdateManagerEnabled: false
      }
    ];
  }

  const subscriptions = await armGetAll<{ subscriptionId: string; displayName: string }>(
    "https://management.azure.com/subscriptions?api-version=2020-01-01",
    armAccessToken
  );

  const serverLists = await Promise.all(
    subscriptions.map(async (sub) => {
      const vmUrl = `https://management.azure.com/subscriptions/${sub.subscriptionId}/providers/Microsoft.Compute/virtualMachines?api-version=2023-09-01`;
      const arcUrl = `https://management.azure.com/subscriptions/${sub.subscriptionId}/providers/Microsoft.HybridCompute/machines?api-version=2023-10-03`;
      const [vms, arcMachines] = await Promise.all([
        armGetAll<{ id: string; name: string; properties?: { storageProfile?: { osDisk?: { osType?: string } } } }>(
          vmUrl,
          armAccessToken
        ).catch(() => []),
        armGetAll<{ id: string; name: string; properties?: { osName?: string } }>(arcUrl, armAccessToken).catch(
          () => []
        )
      ]);

      const mappedVms: ServerItem[] = vms.map((vm) => ({
        id: vm.id,
        name: vm.name,
        resourceGroup: resourceGroupFromId(vm.id),
        subscriptionId: sub.subscriptionId,
        subscriptionName: sub.displayName,
        osType: vm.properties?.storageProfile?.osDisk?.osType === "Windows" ? "Windows" : "Linux",
        isUpdateManagerEnabled: true
      }));
      const mappedArc: ServerItem[] = arcMachines.map((machine) => ({
        id: machine.id,
        name: machine.name,
        resourceGroup: resourceGroupFromId(machine.id),
        subscriptionId: sub.subscriptionId,
        subscriptionName: sub.displayName,
        osType: machine.properties?.osName?.toLowerCase().includes("windows") ? "Windows" : "Linux",
        isUpdateManagerEnabled: true
      }));
      return [...mappedVms, ...mappedArc];
    })
  );

  return serverLists.flat();
}

function buildTerraform(input: TerraformInput): string {
  const windowsClassifications = input.windowsClassifications ?? ["Critical", "Security", "Updates"];
  const linuxClassifications = input.linuxClassifications ?? ["Critical", "Security"];
  const recurEveryLine = input.recurEvery ? `    recur_every         = "${input.recurEvery}"\n` : "";
  const durationLine = input.duration ? `    duration            = "${input.duration}"\n` : "";
  const selected = input.selectedServerIds ?? [];
  const assignments = selected
    .map(
      (id, index) => `resource "azurerm_maintenance_assignment_virtual_machine" "selected_${index + 1}" {
  location                     = "${input.location}"
  maintenance_configuration_id = azurerm_maintenance_configuration.generated.id
  virtual_machine_id           = "${id}"
}`
    )
    .join("\n\n");

  return `resource "azurerm_maintenance_configuration" "generated" {
  name                     = "${input.name}"
  resource_group_name      = "${input.resourceGroupName}"
  location                 = "${input.location}"
  scope                    = "InGuestPatch"
  in_guest_user_patch_mode = "${input.inGuestUserPatchMode}"

  window {
    start_date_time     = "${input.startDateTime}"
    time_zone           = "${input.timeZone}"
${recurEveryLine}${durationLine}  }

  install_patches {
    reboot = "${input.reboot}"

    windows {
      classifications_to_include = ${JSON.stringify(windowsClassifications)}
    }

    linux {
      classifications_to_include = ${JSON.stringify(linuxClassifications)}
    }
  }
}
${assignments ? `\n\n${assignments}` : ""}`;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/config", (req, res) => {
  res.json({
    demoMode,
    localEntraEnabled,
    loginUrl: localEntraEnabled ? "/auth/login" : "/.auth/login/aad",
    logoutUrl: localEntraEnabled ? "/auth/logout" : "/.auth/logout",
    user: getAuthUser(req)
  });
});

app.get("/auth/login", (req, res) => {
  if (!localEntraEnabled) {
    res.redirect("/.auth/login/aad");
    return;
  }
  if (!hasLocalEntraConfig() || !tenantId || !clientId) {
    res.status(500).send("Local Entra auth is enabled but required ENTRA_* variables are missing.");
    return;
  }
  const state = crypto.randomUUID();
  const nonce = crypto.randomBytes(16).toString("hex");
  req.session.authState = state;
  const authorizeUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_mode", "query");
  authorizeUrl.searchParams.set("scope", `openid profile email ${armScope}`);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("nonce", nonce);
  res.redirect(authorizeUrl.toString());
});

app.get("/auth/callback", async (req, res) => {
  try {
    const code = req.query.code;
    const state = req.query.state;
    if (typeof code !== "string" || typeof state !== "string") {
      res.status(400).send("Missing code/state.");
      return;
    }
    if (!req.session.authState || req.session.authState !== state) {
      res.status(400).send("Invalid auth state.");
      return;
    }
    const authResult = await exchangeCodeForUser(code);
    req.session.authUser = authResult.user;
    req.session.armAccessToken = authResult.armAccessToken;
    req.session.authState = undefined;
    res.redirect("/");
  } catch (error) {
    res.status(500).send(`Entra callback failed: ${(error as Error).message}`);
  }
});

app.get("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/api/me", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) {
    return;
  }
  res.json(user);
});

app.get("/api/servers", async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) {
    return;
  }
  try {
    const showEnabledOnly = req.query.showEnabledOnly !== "false";
    const all = await listServersForUser(user, req.session.armAccessToken);
    const filtered = showEnabledOnly ? all.filter((s) => s.isUpdateManagerEnabled) : all;
    res.json({
      showEnabledOnly,
      servers: filtered
    });
  } catch (error) {
    res.status(502).json({
      error: "Failed to enumerate Azure servers for this user.",
      details: (error as Error).message
    });
  }
});

app.post("/api/terraform", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) {
    return;
  }
  const body = req.body as TerraformInput;
  const input: TerraformInput = {
    ...body,
    selectedServerIds: Array.isArray(body.selectedServerIds)
      ? body.selectedServerIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : []
  };
  const terraform = buildTerraform(input);
  res.json({ terraform });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`patch-master-web listening on http://localhost:${port}`);
});
