# One-time Web Push setup (Supabase Edge Function).
# Run in PowerShell from project folder:  .\scripts\setup-push.ps1
#
# Option A (easiest on your PC): script opens browser for Supabase login.
# Option B: create token at https://supabase.com/dashboard/account/tokens
#           save it in scripts/.supabase-token (one line, no quotes)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$ProjectRef = 'prmmnqcjyvghphvnmhkh'
$VapidFile = Join-Path $Root 'scripts\vapid-keys.txt'
$TokenFile = Join-Path $Root 'scripts\.supabase-token'
$ConfigFile = Join-Path $Root 'js\config.js'

function Get-VapidKeys {
  if (-not (Test-Path $VapidFile)) {
    Write-Host 'Generating VAPID keys...' -ForegroundColor Cyan
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
    npx --yes web-push generate-vapid-keys | Out-File -Encoding utf8 $VapidFile
  }
  $text = Get-Content $VapidFile -Raw
  $pub = if ($text -match 'Public Key:\s*(\S+)') { $Matches[1] } else { $null }
  $priv = if ($text -match 'Private Key:\s*(\S+)') { $Matches[1] } else { $null }
  if (-not $pub -or -not $priv) { throw "Could not read keys from $VapidFile" }
  return @{ Public = $pub; Private = $priv }
}

function Update-ConfigJs($publicKey) {
  if (-not (Test-Path $ConfigFile)) { throw "Missing $ConfigFile" }
  $content = Get-Content $ConfigFile -Raw
  if ($content -match 'vapidPublicKey:') {
    $content = $content -replace "vapidPublicKey:\s*'[^']*'", "vapidPublicKey: '$publicKey'"
  } else {
    $content = $content -replace "(\s+supabaseAnonKey:\s*'[^']+',)", "`$1`n  vapidPublicKey: '$publicKey',"
  }
  Set-Content -Path $ConfigFile -Value $content -Encoding utf8 -NoNewline
  Write-Host 'Updated js/config.js (vapidPublicKey)' -ForegroundColor Green
}

$keys = Get-VapidKeys
Update-ConfigJs $keys.Public

$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')

if (-not $env:SUPABASE_ACCESS_TOKEN -and (Test-Path $TokenFile)) {
  $env:SUPABASE_ACCESS_TOKEN = (Get-Content $TokenFile -Raw).Trim()
}

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host ''
  Write-Host 'Supabase login (browser will open - click Authorize)...' -ForegroundColor Cyan
  supabase login
  if ($LASTEXITCODE -ne 0) { throw 'Supabase login failed' }
} else {
  Write-Host 'Using SUPABASE_ACCESS_TOKEN' -ForegroundColor Green
}

$subject = 'mailto:krzysi3k.jurczak@gmail.com'
Write-Host 'Setting VAPID secrets...' -ForegroundColor Cyan
supabase secrets set `
  "VAPID_PUBLIC_KEY=$($keys.Public)" `
  "VAPID_PRIVATE_KEY=$($keys.Private)" `
  "VAPID_SUBJECT=$subject" `
  --project-ref $ProjectRef

Write-Host 'Deploying send-push...' -ForegroundColor Cyan
supabase functions deploy send-push --project-ref $ProjectRef

Write-Host ''
Write-Host 'Done! On each phone: Profile -> Enable notifications -> Allow' -ForegroundColor Green
