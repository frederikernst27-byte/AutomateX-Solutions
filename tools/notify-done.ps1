param(
    [string]$Title = "Codex ist fertig",
    [string]$Message = "Die Antwort oder Aufgabe ist abgeschlossen.",
    [int]$Seconds = 7,
    [switch]$NoSound
)

$ErrorActionPreference = "Stop"

function Show-BalloonNotification {
    param(
        [string]$Title,
        [string]$Message,
        [int]$Seconds
    )

    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $notifyIcon = New-Object System.Windows.Forms.NotifyIcon
    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Information
    $notifyIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
    $notifyIcon.BalloonTipTitle = $Title
    $notifyIcon.BalloonTipText = $Message
    $notifyIcon.Text = $Title
    $notifyIcon.Visible = $true

    $notifyIcon.ShowBalloonTip($Seconds * 1000)
    Start-Sleep -Seconds $Seconds
    $notifyIcon.Dispose()
}

try {
    if (-not $NoSound) {
        [console]::beep(900, 180)
        Start-Sleep -Milliseconds 80
        [console]::beep(1200, 220)
    }

    Show-BalloonNotification -Title $Title -Message $Message -Seconds $Seconds
}
catch {
    Write-Host "$Title - $Message"
    if (-not $NoSound) {
        [console]::beep(1000, 300)
    }
}
