$url = "https://docs.google.com/spreadsheets/d/127m75upB5IPnxQWN7qMqQIJPi-DTQfdjNM66u9NFGfw/export?format=csv&gid=710295863"
$outputDir = "d:\SUM_2026\DASH_REPROCESO\produccion"
$outputFile = Join-Path -Path $outputDir -ChildPath "PRODUCCION.csv"

# Ensure the directory exists
if (-not (Test-Path -Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$intervalMinutes = 8
$intervalSeconds = $intervalMinutes * 60

Write-Host "Iniciando ciclo de descarga cada $intervalMinutes minutos..." -ForegroundColor Cyan

while ($true) {
    try {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "[$timestamp] Descargando Google Sheet..."
        
        Invoke-WebRequest -Uri $url -OutFile $outputFile -UseBasicParsing
        
        Write-Host "[$timestamp] Descarga completada: $outputFile" -ForegroundColor Green
    } catch {
        Write-Error "Error al descargar el archivo: $_"
    }
    
    $nextDownload = (Get-Date).AddSeconds($intervalSeconds)
    Write-Host "Esperando $intervalMinutes minutos para la proxima descarga ($($nextDownload.ToString('HH:mm:ss')))...`n" -ForegroundColor Yellow
    
    Start-Sleep -Seconds $intervalSeconds
}
