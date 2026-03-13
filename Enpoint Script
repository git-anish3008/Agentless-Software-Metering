# ==============================================================================
# INTUNE TELEMETRY ENGINE - DETECTION SCRIPT
# Purpose: Gathers software usage data and pushes it to Azure Log Analytics
# ==============================================================================

$WorkspaceId = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
$SharedKey   = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
$LogType     = "SoftwareMeteringData" # Azure will automatically append _CL to this

# 2. TARGET APPLICATIONS TO MONITOR (Without the .exe)
$TargetApps = @("visio", "chrome", "comet")

# 3. IDENTIFY THE DEVICE
$ComputerName = $env:COMPUTERNAME

# ============================================================================
# 4. IDENTIFY THE HUMAN (The Fix for the Blank Username)
# ============================================================================
$UserName = $null

# Attempt 1: Ask WMI who the active console user is
$LoggedInUser = (Get-WmiObject -Class Win32_ComputerSystem).UserName
if ($LoggedInUser -match "\\") {
    $UserName = $LoggedInUser.Split('\')[1]
} 

# Attempt 2 (Fallback): If WMI is blank, find the owner of the Windows desktop
if (-not $UserName) {
    $ExplorerUser = (Get-Process -Name explorer -IncludeUserName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty UserName | Select-Object -First 1)
    if ($ExplorerUser -match "\\") {
        $UserName = $ExplorerUser.Split('\')[1]
    } else {
        $UserName = "Unknown"
    }
}

# ============================================================================
# 5. SCAN PROCESSES & BUILD THE JSON PAYLOAD
# ============================================================================
$PayloadArray = @()
$RunningProcesses = Get-Process | Select-Object -ExpandProperty Name -Unique

foreach ($App in $TargetApps) {
    if ($RunningProcesses -contains $App) {
        $PayloadArray += [pscustomobject]@{
            ComputerName = $ComputerName
            UserName     = $UserName
            Application  = "$App.exe"
        }
    }
}

# If none of the target apps are running right now, exit successfully so Intune doesn't show an error.
if ($PayloadArray.Count -eq 0) {
    Write-Output "No target applications are currently running. Exiting cleanly."
    Exit 0
}

$JSONPayload = $PayloadArray | ConvertTo-Json

# ============================================================================
# 6. SECURE CRYPTOGRAPHIC HANDSHAKE (HMAC-SHA256)
# ============================================================================
Function New-Signature ($customerId, $sharedKey, $date, $contentLength, $method, $contentType, $resource) {
    $xHeaders = "x-ms-date:$date"
    $stringToHash = $method + "`n" + $contentLength + "`n" + $contentType + "`n" + $xHeaders + "`n" + $resource
    $bytesToHash = [Text.Encoding]::UTF8.GetBytes($stringToHash)
    $keyBytes = [Convert]::FromBase64String($sharedKey)
    $sha256 = New-Object Security.Cryptography.HMACSHA256
    $sha256.Key = $keyBytes
    $calculatedHash = $sha256.ComputeHash($bytesToHash)
    $encodedHash = [Convert]::ToBase64String($calculatedHash)
    $authorization = 'SharedKey {0}:{1}' -f $customerId,$encodedHash
    return $authorization
}

# ============================================================================
# 7. FIRE THE PAYLOAD TO AZURE
# ============================================================================
$Method = "POST"
$ContentType = "application/json"
$Resource = "/api/logs"
$RFC1123date = [DateTime]::UtcNow.ToString("r")
$ContentLength = $JSONPayload.Length

$Signature = New-Signature `
    -customerId $WorkspaceId `
    -sharedKey $SharedKey `
    -date $RFC1123date `
    -contentLength $ContentLength `
    -method $Method `
    -contentType $ContentType `
    -resource $Resource

$Uri = "https://" + $WorkspaceId + ".ods.opinsights.azure.com" + $Resource + "?api-version=2016-04-01"

$Headers = @{
    "Authorization" = $Signature
    "Log-Type"      = $LogType
    "x-ms-date"     = $RFC1123date
}

try {
    Invoke-RestMethod -Uri $Uri -Method $Method -ContentType $ContentType -Headers $Headers -Body $JSONPayload -UseBasicParsing
    Write-Output "Success: Sent $($PayloadArray.Count) records to Azure Log Analytics."
    Exit 0
} catch {
    Write-Error "Failed to send telemetry. Azure Error: $_"
    Exit 1
}
