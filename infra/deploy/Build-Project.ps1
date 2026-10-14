[CmdletBinding()]
param(
    [string]$TenantId = 'a5af7e18-9965-418a-9b8a-a0dd9bd96c52',
    [string]$ClientId = '9870c4b1-0353-4eb0-8e1d-812cb76676b5',
    [string]$Audience = 'ae706c64-5e56-4573-b311-b2919b52c67a'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'DeploymentTools.ps1')
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$output = Join-Path $root 'infra/.deploy'
$stage = Join-Path $output ('staging-' + [guid]::NewGuid())
$initialDirectory = Get-Location
$previousJava = $env:JAVA_HOME
$previousPath = $env:PATH
$environment = @{
    VITE_API_URL = '/'; VITE_GATEWAY_URL = '/'; VITE_RABBIT_ADMIN_URL = '/';
    VITE_AZURE_TENANT_ID = $TenantId; VITE_AZURE_CLIENT_ID = $ClientId;
    VITE_AZURE_API_SCOPE = "api://$Audience/Pedidos.Read"
}
$previousEnvironment = @{}

try {
    foreach ($key in $environment.Keys) {
        $previousEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, $environment[$key], 'Process')
    }
    if (!$env:JAVA_HOME) {
        $jdkRoot = Join-Path $env:USERPROFILE '.jdks'
        $jdk = Get-ChildItem -LiteralPath $jdkRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '21' -and (Test-Path -LiteralPath (Join-Path $_.FullName 'bin/javac.exe')) } |
            Select-Object -First 1
        if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
    }
    if ($env:JAVA_HOME) { $env:PATH = "$env:JAVA_HOME\bin;$env:PATH" }
    Get-Command java -ErrorAction Stop | Out-Null
    Get-Command npm.cmd -ErrorAction Stop | Out-Null
    foreach ($project in @('Backend', 'BffJava')) {
        Set-Location -LiteralPath (Join-Path $root $project)
        & ./mvnw.cmd -B -q verify
        if ($LASTEXITCODE -ne 0) { throw "No compila o fallan las pruebas de $project." }
    }
    Set-Location -LiteralPath (Join-Path $root 'Frontend')
    & npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar dependencias del frontend.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'No compila el frontend.' }

    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    $files = @(
        'Backend/Dockerfile', 'Backend/.dockerignore', 'Backend/target/TiendaLevelUp-0.0.1-SNAPSHOT.jar',
        'BffJava/Dockerfile', 'BffJava/.dockerignore', 'BffJava/target/punto-gamer-bff-1.0.0.jar'
    )
    foreach ($relative in $files) {
        $destination = Join-Path $stage $relative
        New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $root $relative) -Destination $destination
    }
    foreach ($name in @('compose.yml', 'nginx.conf', 'write-application-env.py')) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $stage $name)
    }
    New-Item -ItemType Directory -Path (Join-Path $stage 'Frontend') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $root 'Frontend/dist') -Destination (Join-Path $stage 'Frontend/dist') -Recurse
    Add-Type -AssemblyName System.IO.Compression
    $archivePath = Join-Path $output 'application.zip'
    $stream = [IO.File]::Open($archivePath, [IO.FileMode]::Create)
    $archive = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create)
    try {
        # Fechas fijas y orden estable: un rebuild identico no reemplaza la EC2.
        foreach ($file in (Get-ChildItem -LiteralPath $stage -File -Recurse | Sort-Object FullName)) {
            $name = $file.FullName.Substring($stage.Length + 1).Replace('\', '/')
            $entry = $archive.CreateEntry($name, [IO.Compression.CompressionLevel]::Optimal)
            $entry.LastWriteTime = [DateTimeOffset]::new(2000, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
            $source = [IO.File]::OpenRead($file.FullName)
            $destination = $entry.Open()
            try { $source.CopyTo($destination) } finally { $source.Dispose(); $destination.Dispose() }
        }
    } finally { $archive.Dispose(); $stream.Dispose() }
    $manifest = @{
        artifact_path = $archivePath; artifact_sha256 = (Get-FileHash $archivePath -Algorithm SHA256).Hash;
        frontend_path = Join-Path $root 'Frontend/dist';
        frontend_sha256 = Get-FrontendFingerprint -Path (Join-Path $root 'Frontend/dist')
    }
    [IO.File]::WriteAllText((Join-Path $output 'artifacts.json'), ($manifest | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
    Write-Host 'Paquete listo en infra/.deploy/application.zip. Docker se ejecutara en EC2, no en este PC.'
} finally {
    $env:JAVA_HOME = $previousJava
    $env:PATH = $previousPath
    foreach ($key in $previousEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($key, $previousEnvironment[$key], 'Process')
    }
    Set-Location -LiteralPath $initialDirectory.Path
    if (Test-Path -LiteralPath $stage) {
        $resolved = [IO.Path]::GetFullPath($stage)
        $allowed = [IO.Path]::GetFullPath($output).TrimEnd('\') + '\'
        if ($resolved.StartsWith($allowed, [StringComparison]::OrdinalIgnoreCase) -and
                [IO.Path]::GetFileName($resolved).StartsWith('staging-')) {
            Remove-Item -LiteralPath $resolved -Recurse -Force
        }
    }
}
