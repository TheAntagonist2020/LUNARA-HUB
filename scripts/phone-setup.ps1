# LUNARA FILM Hub — phone setup. Run once: `npm run phone`.
#
# 1. Opens the hub's port on the Private and Domain firewall profiles, so a
#    phone on the same Wi-Fi can reach it. (Node's first-run "Allow" prompt
#    usually opens the Public profile only, and home Wi-Fi is Private.)
# 2. Installs Tailscale (official winget package) for access away from home.
# 3. Prints the address to open on the phone.
#
# Asks Windows for Administrator once. Nothing else on the PC changes.
# Re-running is safe: existing rule and install are left as they are.

param(
  [int]$Port = 3000,
  [switch]$SkipTailscale
)

$ErrorActionPreference = 'Continue'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host 'LUNARA Hub phone setup needs Administrator for the firewall rule.'
  Write-Host 'Windows will ask once (UAC). The elevated window shows the result.'
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'), '-Port', $Port)
  if ($SkipTailscale) { $argList += '-SkipTailscale' }
  try {
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList ($argList -join ' ') -Wait
    Write-Host ''
    Write-Host 'Done. Run `npm run doctor` with the hub running to confirm the phone line is [ OK ].'
  } catch {
    Write-Host '[ -- ] Administrator prompt was declined or failed. Nothing changed.'
    Write-Host '       Manual fix (PowerShell as Administrator):'
    Write-Host ('       netsh advfirewall firewall add rule name="LUNARA Hub" dir=in action=allow protocol=TCP localport=' + $Port + ' profile=private,domain')
  }
  exit
}

# --- 1. Firewall ------------------------------------------------------------
$ruleName = 'LUNARA Hub'
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host ("[ OK ] Firewall rule '{0}' already exists" -f $ruleName)
} else {
  try {
    New-NetFirewallRule -DisplayName $ruleName -Description 'LUNARA FILM Hub: lets the phone reach the local dashboard on home Wi-Fi' `
      -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Profile Private, Domain | Out-Null
    Write-Host ("[ OK ] Firewall: TCP {0} allowed on Private and Domain networks" -f $Port)
  } catch {
    Write-Host ("[ -- ] Could not add the firewall rule: {0}" -f $_.Exception.Message)
  }
}

# --- 2. Tailscale -----------------------------------------------------------
if (-not $SkipTailscale) {
  $tsExe = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
  $installed = (Get-Command tailscale -ErrorAction SilentlyContinue) -or (Test-Path $tsExe)
  if ($installed) {
    Write-Host '[ OK ] Tailscale already installed'
  } else {
    Write-Host 'Installing Tailscale (official winget package, free for personal use)...'
    winget install --id Tailscale.Tailscale --exact --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -eq 0) {
      Write-Host '[ OK ] Tailscale installed'
    } else {
      Write-Host ("[ -- ] winget could not install Tailscale (exit {0}). Download it from https://tailscale.com/download" -f $LASTEXITCODE)
    }
  }
}

# --- 3. What to open on the phone ------------------------------------------
$lan = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254|172\.)' } |
  Select-Object -ExpandProperty IPAddress

Write-Host ''
Write-Host 'Same Wi-Fi — open on the phone:'
if ($lan) { foreach ($ip in $lan) { Write-Host ("    http://{0}:{1}" -f $ip, $Port) } } else { Write-Host '    (no Wi-Fi address found right now)' }
Write-Host '    iPhone: Share -> Add to Home Screen.  Android: menu -> Install app.'
Write-Host ''
Write-Host 'Away from home — Tailscale:'
Write-Host '    1. Open the Tailscale app on this PC and sign in.'
Write-Host '    2. Install Tailscale on the phone and sign in with the same account.'
Write-Host ("    3. On the phone open http://{0}:{1}  (or the IP shown in the Tailscale app)" -f $env:COMPUTERNAME.ToLower(), $Port)
Write-Host ''
Write-Host 'The hub must be running on this PC: npm run dev  (or npm run build, then npm start).'
Write-Host ''
Read-Host 'Press Enter to close'
