# Patch Scheduler Helper — Technical Implementation Guide

## Overview

The Patch Scheduler Helper is a web application that authenticates users via Microsoft Entra ID, enumerates their Azure servers (VMs and Arc machines) using delegated ARM tokens, and generates Terraform code for Azure Update Manager maintenance configurations.

The solution runs on **Azure Static Web Apps** (Standard plan) with an **Azure Functions** API backend.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│                                                                  │
│  index.html ─── MSAL.js 2.x ──► Entra ID (popup login)         │
│       │                             │                            │
│       │  acquireTokenSilent/Popup   │  access_token (ARM scope)  │
│       │◄────────────────────────────┘                            │
│       │                                                          │
│       │  fetch(/api/servers, { X-ARM-Token: <token> })           │
│       ▼                                                          │
├──────────────────────────────────────────────────────────────────┤
│  Azure Static Web App (Standard plan)                            │
│                                                                  │
│  public/                     Static hosting (CDN-distributed)    │
│  api/                        Azure Functions (Node.js 20)        │
│  staticwebapp.config.json    Routing + Entra provider config     │
├──────────────────────────────────────────────────────────────────┤
│  Azure Functions API                                             │
│                                                                  │
│  GET  /api/config     → Returns app config (client ID, etc.)     │
│  GET  /api/health     → Health check                             │
│  GET  /api/me         → Current user identity                    │
│  GET  /api/servers    → Enumerate VMs + Arc machines via ARM     │
│  POST /api/terraform  → Generate Terraform from config input     │
└──────────────────────────────────────────────────────────────────┘
```

## Authentication flow

The app uses **MSAL.js** (Microsoft Authentication Library) in the browser for all authentication. This was chosen over SWA's built-in auth because SWA managed functions do not receive token store headers (`x-ms-token-aad-access-token`), which are needed for ARM API calls on behalf of the user.

### Flow

1. User clicks **"Sign in with Entra"** → `msalInstance.loginPopup()` opens a popup
2. User authenticates with Microsoft → MSAL receives an access token scoped to `https://management.azure.com/user_impersonation`
3. Token is cached in `sessionStorage` by MSAL
4. Frontend sends API requests with `X-ARM-Token: <access_token>` header
5. API backend reads the token and makes ARM REST API calls on behalf of the user

### Why not SWA built-in auth?

SWA's built-in Entra provider (`/.auth/login/aad`) handles sign-in and injects `x-ms-client-principal` into API requests, but **does not forward `x-ms-token-aad-access-token` to managed functions**. Without the ARM-scoped access token, the API cannot call ARM on behalf of the user. MSAL.js in the browser acquires the ARM token directly and passes it via a custom header.

## Project structure

```
patch-master/
├── public/                          # Static frontend (deployed to SWA)
│   ├── index.html                   # Single-page app with MSAL.js
│   └── staticwebapp.config.json     # SWA routing + auth config
│
├── api/                             # Azure Functions backend
│   ├── src/
│   │   ├── functions/
│   │   │   ├── config.ts            # GET /api/config — app settings
│   │   │   ├── health.ts            # GET /api/health — health check
│   │   │   ├── me.ts                # GET /api/me — current user
│   │   │   ├── servers.ts           # GET /api/servers — VM enumeration
│   │   │   └── terraform.ts         # POST /api/terraform — code gen
│   │   └── shared/
│   │       ├── auth.ts              # Token handling (X-ARM-Token, OBO fallback)
│   │       ├── arm.ts               # ARM REST API pagination + server listing
│   │       ├── terraform.ts         # Terraform HCL generation
│   │       └── types.ts             # Shared TypeScript types
│   ├── host.json                    # Azure Functions host config
│   ├── package.json                 # API dependencies (@azure/functions, @azure/msal-node)
│   └── tsconfig.json                # API TypeScript config
│
├── src/
│   └── server.ts                    # Local Express server (for local dev only)
│
├── staticwebapp.config.json         # Root copy of SWA config
├── swa-cli.config.json              # SWA CLI emulator config
├── scripts/
│   └── deploy-swa.ps1              # Automated deployment script
├── .env.local                       # Local dev credentials (gitignored)
├── package.json                     # Root project (Express + build tools)
└── tsconfig.json                    # Root TypeScript config
```

## API reference

### `GET /api/config`

Returns application configuration. Used by the frontend to initialise MSAL.

**Response:**
```json
{
  "demoMode": false,
  "loginUrl": "/.auth/login/aad",
  "logoutUrl": "/.auth/logout",
  "entraClientId": "<client-id>",
  "entraTenantId": "<tenant-id>",
  "user": null
}
```

### `GET /api/servers?showEnabledOnly=true`

Enumerates Azure VMs and Arc machines accessible to the authenticated user.

**Request headers:**
- `X-ARM-Token: <Bearer token>` — ARM-scoped access token from MSAL.js

**Response:**
```json
{
  "showEnabledOnly": true,
  "servers": [
    {
      "id": "/subscriptions/.../virtualMachines/web-01",
      "name": "web-01",
      "resourceGroup": "rg-prod",
      "subscriptionId": "...",
      "subscriptionName": "Production",
      "osType": "Linux",
      "isUpdateManagerEnabled": true
    }
  ]
}
```

Without a valid ARM token, returns stub demo data (2 sample servers).

### `POST /api/terraform`

Generates Terraform HCL from the provided maintenance configuration.

**Request body:**
```json
{
  "name": "mc-weekly",
  "resourceGroupName": "rg-maintenance",
  "location": "australiaeast",
  "inGuestUserPatchMode": "User",
  "startDateTime": "2026-03-01 22:00",
  "timeZone": "AUS Eastern Standard Time",
  "recurEvery": "1Week",
  "duration": "03:00",
  "reboot": "IfRequired",
  "selectedServerIds": ["/subscriptions/.../virtualMachines/web-01"],
  "windowsClassifications": ["Critical", "Security"],
  "linuxClassifications": ["Critical", "Security"]
}
```

**Response:**
```json
{
  "terraform": "resource \"azurerm_maintenance_configuration\" \"generated\" { ... }"
}
```

Generated resources:
- `azurerm_maintenance_configuration.generated` — the maintenance window
- `azurerm_maintenance_assignment_virtual_machine.selected_N` — one per selected server

## Deployment

### Prerequisites

| Tool | Purpose |
|------|---------|
| Azure CLI (`az`) | Create Azure resources, manage app registration |
| SWA CLI (`swa`) | Deploy to Azure Static Web Apps |
| Node.js 20+ | Build the API functions |
| Azure subscription | Host the Static Web App (Standard plan) |

### Entra app registration

1. **Create an app registration** in the Azure portal (Microsoft Entra ID → App registrations)
2. **Add delegated API permissions:**
   - `Microsoft Graph` → `User.Read`
   - `Azure Service Management` → `user_impersonation`
3. **Grant admin consent** for `user_impersonation`
4. **Create a client secret** (Certificates & secrets → New client secret)
5. **Add SPA redirect URIs** (Authentication → Single-page application):
   - `https://<swa-hostname>/` (for production)
   - `http://localhost:3000/` (for local development)
6. **Add Web redirect URIs** (if using SWA built-in auth as backup):
   - `https://<swa-hostname>/.auth/login/aad/callback`
   - `http://localhost:3000/auth/callback`

### Deploy with script

```powershell
.\scripts\deploy-swa.ps1 `
    -TenantId "<tenant-id>" `
    -ClientId "<client-id>" `
    -ClientSecret "<client-secret>" `
    -Location "eastasia" `
    -ResourceGroup "rg-patch-master" `
    -SwaName "patch-master-swa"
```

The script:
1. Creates the resource group
2. Creates a Static Web App (Standard plan)
3. Sets `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` as SWA environment variables
4. Updates `staticwebapp.config.json` with the tenant ID
5. Builds the API and deploys via `swa deploy`

### Manual deployment

```bash
# 1. Create SWA resource
az group create --name rg-patch-master --location eastasia
az staticwebapp create --name patch-master-swa --resource-group rg-patch-master \
    --location eastasia --sku Standard

# 2. Set environment variables
az staticwebapp appsettings set --name patch-master-swa --resource-group rg-patch-master \
    --setting-names "AZURE_CLIENT_ID=<id>" "AZURE_CLIENT_SECRET=<secret>" "AZURE_TENANT_ID=<tenant>"

# 3. Build API
cd api && npm install && npm run build && cd ..

# 4. Deploy
swa deploy --app-location public --api-location api --output-location . \
    --env production --deployment-token <token>
```

### SWA region availability

Azure Static Web Apps is available in: `westus2`, `centralus`, `eastus2`, `westeurope`, `eastasia`. The region only affects where the API backend runs — static content is served globally via CDN.

## Local development

### Express server (recommended for local dev)

The local development experience uses a standalone Express server that handles both static file serving and API endpoints, with session-based Entra OIDC for authentication.

```bash
# 1. Install dependencies
npm install

# 2. Configure .env.local
cp .env.local.example .env.local   # Then fill in your Entra values

# 3. Start dev server
npm run dev

# 4. Visit http://localhost:3000
```

**`.env.local` variables:**

| Variable | Description |
|----------|-------------|
| `ENTRA_TENANT_ID` | Your Entra tenant ID |
| `ENTRA_CLIENT_ID` | App registration client ID |
| `ENTRA_CLIENT_SECRET` | App registration client secret |
| `ENTRA_REDIRECT_URI` | `http://localhost:3000/auth/callback` |
| `LOCAL_ENTRA_AUTH` | Set to `true` to enable local Entra login |
| `DEMO_MODE` | Set to `true` for anonymous access with stub data |
| `SESSION_SECRET` | Random string for session encryption |

### SWA CLI emulator

The SWA CLI can emulate the full SWA environment locally, but requires Node.js ≤22 (Azure Functions Core Tools constraint).

```bash
cd api && npm install && npm run build && cd ..
swa start public --api-location api
```

## ARM token acquisition — detailed flow

```
Frontend (MSAL.js)                 Entra ID                    API Function
       │                              │                             │
       │── loginPopup() ──────────────►│                             │
       │   scopes: [user_impersonation]│                             │
       │                              │                             │
       │◄── access_token (ARM scope) ──│                             │
       │                              │                             │
       │── GET /api/servers ──────────────────────────────────────────►│
       │   X-ARM-Token: <token>       │                             │
       │                              │          ┌──────────────────│
       │                              │          │ Read X-ARM-Token │
       │                              │          │ Call ARM REST API│
       │                              │          │ with Bearer token│
       │                              │          └──────────────────│
       │◄── { servers: [...] } ────────────────────────────────────────│
```

The API function (`api/src/shared/auth.ts`) checks three token sources in order:
1. `X-ARM-Token` header (from MSAL.js in the browser) — **primary path**
2. `x-ms-token-aad-access-token` header (SWA token store) — not available for managed functions
3. On-Behalf-Of flow with `x-ms-token-aad-id-token` — fallback using MSAL Node.js

## Terraform output

The generated Terraform uses the `azurerm` provider and produces:

### `azurerm_maintenance_configuration`

Defines the maintenance window, patch classifications, and reboot settings. Maps directly to the Azure Update Manager maintenance configuration ARM resource.

### `azurerm_maintenance_assignment_virtual_machine`

One resource per selected server. Associates the VM with the maintenance configuration by resource ID.

### Example output

```hcl
resource "azurerm_maintenance_configuration" "generated" {
  name                     = "mc-weekly"
  resource_group_name      = "rg-maintenance"
  location                 = "australiaeast"
  scope                    = "InGuestPatch"
  in_guest_user_patch_mode = "User"

  window {
    start_date_time     = "2026-03-01 22:00"
    time_zone           = "AUS Eastern Standard Time"
    recur_every         = "1Week"
    duration            = "03:00"
  }

  install_patches {
    reboot = "IfRequired"

    windows {
      classifications_to_include = ["Critical", "Security", "Updates"]
    }

    linux {
      classifications_to_include = ["Critical", "Security"]
    }
  }
}

resource "azurerm_maintenance_assignment_virtual_machine" "selected_1" {
  location                     = "australiaeast"
  maintenance_configuration_id = azurerm_maintenance_configuration.generated.id
  virtual_machine_id           = "/subscriptions/.../virtualMachines/web-01"
}
```

## Security considerations

- **No secrets in the frontend** — the client ID and tenant ID are public identifiers, not secrets. The client secret is only stored in SWA environment variables (server-side).
- **Delegated access only** — the app uses delegated permissions (`user_impersonation`), meaning it can only access resources the signed-in user already has access to. It cannot escalate privileges.
- **No data persistence** — no server data, tokens, or generated Terraform is stored by the application. ARM tokens are held in browser `sessionStorage` and cleared when the tab closes.
- **Read-only** — the app only reads server information from Azure. It does not create, modify, or delete any Azure resources.
- **Tenant-restricted** — the `staticwebapp.config.json` `openIdIssuer` restricts sign-in to a specific Entra tenant.
