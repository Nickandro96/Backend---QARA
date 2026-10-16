param(
  [Parameter(Mandatory = $true)][string]$MySqlDumpPath,
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [int64]$MinimumBytes = 1048576,
  [int]$RetentionDays = 35
)

$ErrorActionPreference = "Stop"
$required = "MYSQLHOST", "MYSQLPORT", "MYSQLUSER", "MYSQLPASSWORD", "MYSQLDATABASE"
$missing = @($required | Where-Object { [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_)) })
if ($missing.Count -gt 0) { throw "Variables absentes : $($missing -join ', ')" }
if (-not (Test-Path -LiteralPath $MySqlDumpPath -PathType Leaf)) { throw "mysqldump introuvable." }

$resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)
$volumeRoot = [IO.Path]::GetPathRoot($resolvedOutput)
if ($resolvedOutput -eq $volumeRoot) { throw "Le dossier de sauvegarde ne peut pas être la racine du volume." }
[IO.Directory]::CreateDirectory($resolvedOutput) | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dumpPath = Join-Path $resolvedOutput "qara-$stamp.sql"
$manifestPath = "$dumpPath.manifest.json"
$startedAt = Get-Date

$env:MYSQL_PWD = $env:MYSQLPASSWORD
try {
  & $MySqlDumpPath `
    "--host=$env:MYSQLHOST" `
    "--port=$env:MYSQLPORT" `
    "--user=$env:MYSQLUSER" `
    --protocol=TCP --single-transaction --quick --routines --events --triggers `
    --no-tablespaces --set-gtid-purged=OFF `
    "--databases" $env:MYSQLDATABASE `
    "--result-file=$dumpPath"
  if ($LASTEXITCODE -ne 0) { throw "mysqldump a échoué (code $LASTEXITCODE)." }
} finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}

$file = Get-Item -LiteralPath $dumpPath
if ($file.Length -lt $MinimumBytes) { throw "Sauvegarde anormalement petite : $($file.Length) octets." }
$hash = (Get-FileHash -LiteralPath $dumpPath -Algorithm SHA256).Hash.ToLowerInvariant()
$manifest = [ordered]@{
  createdAt = $file.LastWriteTimeUtc.ToString("o")
  completedAt = (Get-Date).ToUniversalTime().ToString("o")
  durationSeconds = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 2)
  database = $env:MYSQLDATABASE
  file = $file.Name
  bytes = $file.Length
  sha256 = $hash
  verifiedNonEmpty = $true
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8NoBOM

$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -LiteralPath $resolvedOutput -File -Filter "qara-*.sql*" |
  Where-Object LastWriteTime -lt $cutoff |
  Remove-Item -Force

$manifest | ConvertTo-Json
