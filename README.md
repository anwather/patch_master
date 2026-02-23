# Patch Scheduler Helper

Sign in with Entra ID, enumerate Azure servers, configure patch schedules, and generate Terraform for Azure Update Manager maintenance configurations.

## Architecture

- **Frontend**: Static HTML/JS in `public/`
- **Backend (local)**: Express server in `src/server.ts` with session-based Entra OIDC
- **Backend (cloud)**: Azure Functions in `api/` deployed via Azure Static Web Apps
- **Auth**: Microsoft Entra ID (local: OAuth2 code grant; cloud: SWA built-in auth + OBO flow)

## Run locally (Express server)

```bash
npm install
npm run dev
```

Demo mode (no login):
```bash
$env:DEMO_MODE="true"
npm run dev
```

With Entra sign-in (set values in `.env.local` first):
```bash
npm run dev
# Visit http://localhost:3000/auth/login
```

## Deploy to Azure Static Web Apps

### Prerequisites
- Azure CLI (`az`)
- SWA CLI (`npm install -g @azure/static-web-apps-cli`)
- Entra app registration with:
  - Delegated permission: `Azure Service Management / user_impersonation` (admin consent)
  - Delegated permission: `Microsoft Graph / User.Read`
  - Client secret generated

### Deploy
```powershell
.\scripts\deploy-swa.ps1 `
    -TenantId "<tenant-id>" `
    -ClientId "<client-id>" `
    -ClientSecret "<client-secret>" `
    -Location "australiaeast"
```

After deployment, add the redirect URI to your app registration:
```
https://<swa-hostname>/.auth/login/aad/callback
```

### How it works in SWA
- SWA built-in auth handles Entra sign-in (`/.auth/login/aad`)
- User identity passed to API via `x-ms-client-principal` header
- ARM token acquired via MSAL On-Behalf-Of flow in the Azure Functions backend
- `staticwebapp.config.json` enforces authentication on `/api/*` routes

## Project structure

```
├── public/                    # Static frontend
│   └── index.html
├── src/                       # Local Express server
│   └── server.ts
├── api/                       # Azure Functions (SWA backend)
│   ├── src/functions/         # Function handlers
│   │   ├── config.ts
│   │   ├── me.ts
│   │   ├── servers.ts
│   │   └── terraform.ts
│   ├── src/shared/            # Shared modules
│   │   ├── auth.ts
│   │   ├── arm.ts
│   │   ├── terraform.ts
│   │   └── types.ts
│   ├── host.json
│   └── package.json
├── staticwebapp.config.json   # SWA auth + routing config
├── swa-cli.config.json        # Local SWA emulator config
└── scripts/
    └── deploy-swa.ps1         # Deployment script
```

## Required Azure permissions

- **App registration**: delegated `user_impersonation` (Azure Service Management) with admin consent
- **User RBAC**: at least Reader on subscriptions to enumerate VMs/Arc machines
- **Arc servers**: `Microsoft.HybridCompute/machines/read` if applicable
