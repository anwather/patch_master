# Patch Scheduler Helper

Sign in with Entra ID, enumerate Azure servers, configure patch schedules, and generate Terraform for Azure Update Manager maintenance configurations.

## Documentation

- **[User Guide](docs/user-guide.md)** — How to use the app: sign in, select servers, configure schedules, generate Terraform
- **[Technical Guide](docs/technical-guide.md)** — Architecture, authentication flow, API reference, deployment, security

## Quick start

### Local development

```bash
npm install
cp .env.local.example .env.local   # Fill in Entra values
npm run dev                         # Visit http://localhost:3000
```

### Deploy to Azure

```powershell
.\scripts\deploy-swa.ps1 -TenantId "<tenant>" -ClientId "<client>" -ClientSecret "<secret>"
```

See the [Technical Guide](docs/technical-guide.md#deployment) for full deployment instructions.

## Architecture

```
Browser (MSAL.js) ──► Entra ID popup login ──► ARM access token
    │
    ├── GET /api/servers  { X-ARM-Token }  ──► Azure Functions ──► ARM REST API
    ├── POST /api/terraform                ──► Terraform HCL output
    │
Azure Static Web App (Standard plan)
    ├── public/          Static frontend
    └── api/             Azure Functions (Node.js 20)
```

## Required permissions

| Scope | Purpose |
|-------|---------|
| `Azure Service Management / user_impersonation` | Read VMs and Arc machines |
| `Microsoft Graph / User.Read` | Read user profile |
| Azure RBAC Reader on subscriptions | Enumerate servers |
