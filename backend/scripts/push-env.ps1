# Copies every filled-in value from backend/.env into the linked Vercel project (Production).
# Run from D:\Geetzy\backend after `npx vercel link`:
#   powershell -ExecutionPolicy Bypass -File .\scripts\push-env.ps1
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path ".vercel\project.json")) {
  Write-Host "Run 'npx vercel link' in D:\Geetzy\backend first." -ForegroundColor Red
  exit 1
}

# Values only the server needs to know are stored as Secrets (hidden in the dashboard).
$secretNames = @('SUPABASE_SECRET_KEY', 'GEMINI_API_KEY', 'JSON2VIDEO_API_KEY', 'INTERNAL_SECRET', 'WEBHOOK_SECRET')
$failed = 0

foreach ($line in Get-Content ".env") {
  if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
  $name, $value = $line -split '=', 2
  $name = $name.Trim(); $value = $value.Trim()
  if (-not $value) { Write-Host "skip  $name (empty)" -ForegroundColor DarkGray; continue }

  $type = if ($secretNames -contains $name) { '--sensitive' } else { '--no-sensitive' }
  # --force replaces an old value; --value avoids a hidden newline at the end of the key.
  npx --yes vercel env add $name --environment production --value $value --force --yes $type *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "set   $name" -ForegroundColor Green
  } else {
    Write-Host "FAIL  $name  (try: npx vercel env add $name --environment production)" -ForegroundColor Red
    $failed++
  }
}

if ($failed) { Write-Host "$failed variable(s) failed." -ForegroundColor Red; exit 1 }
Write-Host "Done. Now deploy with:  npx vercel --prod" -ForegroundColor Magenta
