param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("demo", "secure")]
  [string]$Mode,
  [Parameter(Mandatory = $false)]
  [string]$ResourceGroupName = "rg-patch-master-aue",
  [Parameter(Mandatory = $false)]
  [string]$AppName = "patch-master-pko9ha"
)

$ErrorActionPreference = "Stop"

$demo = if ($Mode -eq "demo") { "true" } else { "false" }
az webapp config appsettings set `
  --name $AppName `
  --resource-group $ResourceGroupName `
  --settings DEMO_MODE=$demo NODE_ENV=production `
  --output none

Write-Host "Mode updated to $Mode (DEMO_MODE=$demo)."
Write-Host "App URL: https://$AppName.azurewebsites.net"
