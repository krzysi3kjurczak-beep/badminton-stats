# Ustawia sekrety VAPID w Supabase (wymagane do dzialania push).
# Uruchom: powershell -ExecutionPolicy Bypass -File .\scripts\set-vapid-secrets.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$VapidFile = Join-Path $Root 'scripts\vapid-keys.txt'
$ProjectRef = 'prmmnqcjyvghphvnmhkh'

$text = Get-Content $VapidFile -Raw
$pub = if ($text -match 'Public Key:\s*(\S+)') { $Matches[1] } else { $null }
$priv = if ($text -match 'Private Key:\s*(\S+)') { $Matches[1] } else { $null }
if (-not $pub -or -not $priv) { throw "Brak kluczy w $VapidFile" }

$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')

Write-Host 'Ustawiam sekrety VAPID w Supabase...' -ForegroundColor Cyan
supabase secrets set `
  "VAPID_PUBLIC_KEY=$pub" `
  "VAPID_PRIVATE_KEY=$priv" `
  "VAPID_SUBJECT=mailto:krzysi3k.jurczak@gmail.com" `
  --project-ref $ProjectRef

Write-Host ''
Write-Host 'Gotowe. Przetestuj zaproszenie (apka zamknieta u zaproszonej osoby).' -ForegroundColor Green
