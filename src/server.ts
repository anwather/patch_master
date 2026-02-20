import express, { Request, Response } from "express";
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
  osType: "Windows" | "Linux";
  isUpdateManagerEnabled: boolean;
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
  windowsClassifications?: string[];
  linuxClassifications?: string[];
};

const app = express();
const port = Number(process.env.PORT ?? 3000);
const publicDir = path.join(process.cwd(), "public");
const demoMode = process.env.DEMO_MODE === "true";

app.use(express.json());
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
  if (process.env.NODE_ENV !== "production") {
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
      error: "Unauthorized. Configure App Service Authentication with Entra ID."
    });
    return undefined;
  }
  return user;
}

async function listServersForUser(_user: AuthUser): Promise<ServerItem[]> {
  // Starter implementation; replace with ARM + Resource Graph calls using delegated user token.
  return [
    {
      id: "/subscriptions/000/resourceGroups/rg-app/providers/Microsoft.Compute/virtualMachines/app-01",
      name: "app-01",
      resourceGroup: "rg-app",
      osType: "Windows",
      isUpdateManagerEnabled: true
    },
    {
      id: "/subscriptions/000/resourceGroups/rg-data/providers/Microsoft.Compute/virtualMachines/data-01",
      name: "data-01",
      resourceGroup: "rg-data",
      osType: "Linux",
      isUpdateManagerEnabled: false
    }
  ];
}

function buildTerraform(input: TerraformInput): string {
  const windowsClassifications = input.windowsClassifications ?? ["Critical", "Security", "Updates"];
  const linuxClassifications = input.linuxClassifications ?? ["Critical", "Security"];
  const recurEveryLine = input.recurEvery ? `    recur_every         = "${input.recurEvery}"\n` : "";
  const durationLine = input.duration ? `    duration            = "${input.duration}"\n` : "";

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
}`;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/config", (req, res) => {
  res.json({
    demoMode,
    user: getAuthUser(req)
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
  const showEnabledOnly = req.query.showEnabledOnly !== "false";
  const all = await listServersForUser(user);
  const filtered = showEnabledOnly ? all.filter((s) => s.isUpdateManagerEnabled) : all;
  res.json({
    showEnabledOnly,
    servers: filtered
  });
});

app.post("/api/terraform", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) {
    return;
  }
  const input = req.body as TerraformInput;
  const terraform = buildTerraform(input);
  res.json({ terraform });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`patch-master-web listening on http://localhost:${port}`);
});
