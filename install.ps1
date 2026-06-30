# Installs / updates the AE Iterations CEP extension on Windows.
# Run from PowerShell: .\install.ps1
# Quit After Effects before running, then reopen it.

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Src       = Join-Path $ScriptDir "extension"
$Dest      = Join-Path $env:APPDATA "Adobe\CEP\extensions\com.aeiter.iteration"

Write-Host "Source:      $Src"
Write-Host "Destination: $Dest"
Write-Host ""

# Enable unsigned CEP extensions (PlayerDebugMode) for CSXS 11 and 12
foreach ($ver in @("CSXS.11", "CSXS.12")) {
    $key = "HKCU:\SOFTWARE\Adobe\$ver"
    if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
    Set-ItemProperty -Path $key -Name "PlayerDebugMode" -Value "1" -Type String
}
Write-Host "PlayerDebugMode enabled for CSXS.11 and CSXS.12"

# Copy everything except the jsx folder
if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
Copy-Item -Recurse -Force $Src $Dest

# Remove the jsx folder that was just copied — we'll rebuild host.jsx
$DestJsx = Join-Path $Dest "jsx"
if (Test-Path $DestJsx) { Remove-Item -Recurse -Force $DestJsx }
New-Item -ItemType Directory -Path $DestJsx | Out-Null

Write-Host "Building jsx/host.jsx from lib files..."

$LibFiles = @(
    "naming.jsx",
    "layer-utils.jsx",
    "apply-change.jsx",
    "apply-video.jsx",
    "apply-media.jsx",
    "apply-emoji.jsx",
    "render.jsx",
    "clean.jsx",
    "collect.jsx",
    "project.jsx"
)

$HostOut = Join-Path $DestJsx "host.jsx"

# Concatenate lib files
foreach ($lib in $LibFiles) {
    Get-Content (Join-Path $Src "jsx\lib\$lib") | Add-Content $HostOut
}

# Append host.jsx body, skipping #include lines
Get-Content (Join-Path $Src "jsx\host.jsx") |
    Where-Object { $_ -notmatch "^#include" } |
    Add-Content $HostOut

Write-Host "Done. Restart After Effects and open Window > Extensions > AE Iterations."
