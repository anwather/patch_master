# Deploy Patch Scheduler Helper to Azure Static Web Apps
# Prerequisites: Azure CLI, SWA CLI (npm install -g @azure/static-web-apps-cli)

param(
    [string]$ResourceGroup = "rg-patch-master",
    [string]$Location = "australiaeast",
    [string]$SwaName = "patch-master-swa",
    [string]$Sku = "Standard",
    [string]$TenantId = "",
    [string]$ClientId = "",
    [string]$ClientSecret = ""
)

$ErrorActionPreference = "Stop"

Write-Host "=== Deploying Patch Scheduler Helper to Azure Static Web Apps ===" -ForegroundColor Cyan

# 1. Create resource group
Write-Host "`n[1/5] Creating resource group '$ResourceGroup' in '$Location'..." -ForegroundColor Yellow
az group create --name $ResourceGroup --location $Location --output none

# 2. Create Static Web App
Write-Host "`n[2/5] Creating Static Web App '$SwaName' (SKU: $Sku)..." -ForegroundColor Yellow
$swaResult = az staticwebapp create `
    --name $SwaName `
    --resource-group $ResourceGroup `
    --location $Location `
    --sku $Sku `
    --output json | ConvertFrom-Json

$swaHostname = $swaResult.defaultHostname
Write-Host "  SWA hostname: $swaHostname" -ForegroundColor Green

# 3. Get deployment token
Write-Host "`n[3/5] Retrieving deployment token..." -ForegroundColor Yellow
$deployToken = az staticwebapp secrets list `
    --name $SwaName `
    --resource-group $ResourceGroup `
    --query "properties.apiKey" -o tsv

# 4. Configure Entra settings as environment variables
if ($ClientId -and $ClientSecret -and $TenantId) {
    Write-Host "`n[4/5] Configuring Entra ID environment variables..." -ForegroundColor Yellow
    az staticwebapp appsettings set `
        --name $SwaName `
        --resource-group $ResourceGroup `
        --setting-names `
            "AZURE_CLIENT_ID=$ClientId" `
            "AZURE_CLIENT_SECRET=$ClientSecret" `
            "AZURE_TENANT_ID=$TenantId" `
        --output none
    Write-Host "  Entra settings configured." -ForegroundColor Green

    # Update staticwebapp.config.json with real tenant ID
    $configPath = Join-Path $PSScriptRoot "..\staticwebapp.config.json"
    $config = Get-Content $configPath -Raw
    $config = $config -replace "<TENANT_ID>", $TenantId
    Set-Content $configPath $config
    Write-Host "  Updated staticwebapp.config.json with tenant ID." -ForegroundColor Green
} else {
    Write-Host "`n[4/5] Skipping Entra config (no credentials provided). Set DEMO_MODE=true for demo." -ForegroundColor Yellow
    az staticwebapp appsettings set `
        --name $SwaName `
        --resource-group $ResourceGroup `
        --setting-names "DEMO_MODE=true" `
        --output none
}

# 5. Deploy using SWA CLI
Write-Host "`n[5/5] Deploying app with SWA CLI..." -ForegroundColor Yellow
Write-Host "  Building API..." -ForegroundColor Yellow
Push-Location (Join-Path $PSScriptRoot "..\api")
npm run build
Pop-Location

Write-Host "  Deploying to SWA..." -ForegroundColor Yellow
swa deploy `
    --app-location (Join-Path $PSScriptRoot "..\public") `
    --api-location (Join-Path $PSScriptRoot "..\api") `
    --deployment-token $deployToken

Write-Host "`n=== Deployment complete ===" -ForegroundColor Green
Write-Host "App URL: https://$swaHostname" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Register/update Entra app redirect URI: https://$swaHostname/.auth/login/aad/callback"
Write-Host "  2. Ensure 'user_impersonation' delegated permission has admin consent"
Write-Host "  3. Test: https://$swaHostname"
