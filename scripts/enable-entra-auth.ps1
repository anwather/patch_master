param(
  [Parameter(Mandatory = $false)]
  [string]$ResourceGroupName = "rg-patch-master-aue",
  [Parameter(Mandatory = $false)]
  [string]$AppName = "patch-master-pko9ha"
)

$ErrorActionPreference = "Stop"
$tenantId = az account show --query tenantId -o tsv
$redirectUri = "https://$AppName.azurewebsites.net/.auth/login/aad/callback"
$aud1 = "https://$AppName.azurewebsites.net"
$aud2 = "https://$AppName.azurewebsites.net/.auth/login/aad/callback"
$displayName = "$AppName-auth"

$clientId = az ad app list --display-name $displayName --query "[0].appId" -o tsv
if (-not $clientId) {
  $clientId = az ad app create --display-name $displayName --web-redirect-uris $redirectUri --query appId -o tsv
} else {
  az ad app update --id $clientId --web-redirect-uris $redirectUri --output none
}

$secret = az ad app credential reset --id $clientId --append --display-name "webapp-auth-secret" --years 2 --query password -o tsv
az webapp config appsettings set --name $AppName --resource-group $ResourceGroupName --settings AAD_CLIENT_SECRET=$secret --output none

$issuer = "https://sts.windows.net/$tenantId/"
az webapp auth-classic update -g $ResourceGroupName -n $AppName --enabled true --action AllowAnonymous --runtime-version "~1" --token-store true --aad-client-id $clientId --aad-secret-setting AAD_CLIENT_SECRET --aad-token-issuer-url $issuer --aad-allowed-token-audiences $aud1 $aud2 --output none

Write-Host "Entra login enabled."
Write-Host "Login URL: https://$AppName.azurewebsites.net/.auth/login/aad"
