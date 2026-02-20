# Patch Scheduler Helper (Starter)

This project is a starter web app for customers to sign in, list accessible servers, select patch settings, and generate Terraform for Azure Update Manager maintenance configurations.

## Hosting decision

Recommended host: **Azure App Service (Web App)** with **App Service Authentication (Easy Auth) + Microsoft Entra ID**.

Why this is the best fit for this solution:
- Native Entra sign-in integration at the platform layer.
- Backend APIs can enforce authentication and use user context for access-aware server listing.
- Supports full web app + API hosting in one resource, with straightforward CI/CD and scaling.

## Auth model (initial)

- In Azure, Easy Auth injects `X-MS-CLIENT-PRINCIPAL` headers.
- The server reads that identity and requires auth for `/api/*`.
- Local dev uses a mock identity when `NODE_ENV` is not `production`.
- Demo mode can be enabled with `DEMO_MODE=true` to allow anonymous testing.

## Update Manager eligibility highlighting

- UI defaults to **Show enabled only**.
- API supports `showEnabledOnly=true|false`.
- Server data includes `isUpdateManagerEnabled`; enabled servers are highlighted.

> Current implementation uses stub server data. Next step is replacing it with Azure ARM + Resource Graph queries using delegated user access.

## Run locally

```bash
npm install
npm run dev
```

Run in demo mode:

```bash
$env:DEMO_MODE="true"
npm run dev
```

Build + run:

```bash
npm run build
npm start
```

## Next steps

1. Replace `listServersForUser` with Azure SDK calls:
   - List user-accessible VMs/Arc servers.
   - Join with Update Manager telemetry (`patchassessmentresources`) to set `isUpdateManagerEnabled`.
2. Add server selection and emit Terraform assignments:
   - `azurerm_maintenance_assignment_virtual_machine` and/or dynamic scope assignment.
3. Add secure token acquisition path for ARM/ARG calls with delegated user scopes.
4. Enable Easy Auth in App Service and wire app registration settings for tenant-restricted Entra login.

## Azure deployment (App Service)

Use the helper script to deploy a demo instance (anonymous mode enabled):

```powershell
.\scripts\deploy-appservice.ps1 -SubscriptionId "<sub-id>" -Location "westeurope"
```

After deployment, switch between demo and secure modes:

```powershell
.\scripts\set-mode.ps1 -Mode demo    # no login required
.\scripts\set-mode.ps1 -Mode secure  # Entra login required by app APIs
```

Entra login endpoint:

```text
https://<app-name>.azurewebsites.net/.auth/login/aad
```
