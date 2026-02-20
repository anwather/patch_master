param(
  [Parameter(Mandatory = $true)]
  [string]$SubscriptionId,
  [Parameter(Mandatory = $false)]
  [string]$Location = "westeurope",
  [Parameter(Mandatory = $false)]
  [string]$ResourceGroupName = "rg-patch-master-demo",
  [Parameter(Mandatory = $false)]
  [string]$AppName = ""
)

$ErrorActionPreference = "Stop"

if (-not $AppName) {
  $suffix = -join ((97..122) + (48..57) | Get-Random -Count 6 | ForEach-Object { [char]$_ })
  $AppName = "patch-master-$suffix"
}

Write-Host "Using app name: $AppName"
az account set --subscription $SubscriptionId | Out-Null
az group create --name $ResourceGroupName --location $Location --output none

az webapp up `
  --name $AppName `
  --resource-group $ResourceGroupName `
  --location $Location `
  --runtime "NODE:20-lts" `
  --sku B1 `
  --logs `
  --track-status false

az webapp config appsettings set `
  --name $AppName `
  --resource-group $ResourceGroupName `
  --settings NODE_ENV=production DEMO_MODE=true `
  --output none

$hostName = az webapp show --name $AppName --resource-group $ResourceGroupName --query defaultHostName -o tsv
Write-Host "Deployment complete: https://$hostName"
