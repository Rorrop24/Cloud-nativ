[CmdletBinding()]
param(
    [string]$TenantId = '6fb3d735-1c10-4007-b977-7dbea3388386',
    [string]$ClientId = '30a37963-4067-4ac4-a8c4-fe7edcd2c289',
    [string]$Audience = 'ff0f75e1-6d35-40f4-89ae-44a2cfacd4b1'
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
        if (!$env:JAVA_HOME) {
            $androidJdk = Join-Path $env:ProgramFiles 'Android/Android Studio/jbr'
            if (Test-Path -LiteralPath (Join-Path $androidJdk 'bin/javac.exe')) {
                $env:JAVA_HOME = $androidJdk
            }
        }
    }
    if ($env:JAVA_HOME) { $env:PATH = "$env:JAVA_HOME\bin;$env:PATH" }
    Get-Command java -ErrorAction Stop | Out-Null
    Get-Command npm.cmd -ErrorAction Stop | Out-Null
    Set-Location -LiteralPath $root
    & ./mvnw.cmd -B -q clean verify
    if ($LASTEXITCODE -ne 0) { throw 'No compila o fallan las pruebas de los seis servicios Java.' }
    Set-Location -LiteralPath (Join-Path $root 'FrontendAngular')
    & npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar dependencias Angular.' }
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Fallan las pruebas de autenticacion Angular.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'No compila Angular.' }

    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    $files = @(
        'Backend/Dockerfile', 'Backend/.dockerignore', 'Backend/target/TiendaLevelUp-0.0.1-SNAPSHOT.jar',
        'BffJava/Dockerfile', 'BffJava/.dockerignore', 'BffJava/target/punto-gamer-bff-1.0.0.jar'
    )
    foreach ($service in @('cart-service','inventory-service','notification-service','rabbit-admin-service')) {
        $files += "services/$service/Dockerfile"
        $files += "services/$service/.dockerignore"
        $files += "services/$service/target/$service-1.0.0.jar"
    }
    foreach ($relative in $files) {
        $destination = Join-Path $stage $relative
        New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $root $relative) -Destination $destination
    }
    foreach ($name in @('compose.yml', 'nginx.conf', 'write-application-env.py')) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $stage $name)
    }
    $productionConfig = @{ tenantId=$TenantId; clientId=$ClientId; apiScope="api://$Audience/Pedidos.Read"; bffUrl='/'; backendUrl='/'; cartUrl='/'; adminUrl='/'; notificationsUrl='/'; inventoryUrl='/' }
    [IO.File]::WriteAllText((Join-Path $root 'FrontendAngular/dist/punto-gamer/browser/config.json'), ($productionConfig | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
    New-Item -ItemType Directory -Path (Join-Path $stage 'Frontend') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $root 'FrontendAngular/dist/punto-gamer/browser') -Destination (Join-Path $stage 'Frontend/dist') -Recurse
    $publicConfiguration = @{
        tenantId = $TenantId; clientId = $ClientId; apiScope = "api://$Audience/Pedidos.Read";
        bffUrl = '/'; backendUrl = '/'; cartUrl = '/'; adminUrl = '/'; notificationsUrl = '/'; inventoryUrl = '/'
    }
    [IO.File]::WriteAllText((Join-Path $stage 'Frontend/dist/config.json'), ($publicConfiguration | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
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
    $manifest = @{ release_schema = 2; java_services = @("backend","bff","cart","inventory","notifications","rabbit-admin");
        artifact_path = $archivePath; artifact_sha256 = (Get-FileHash $archivePath -Algorithm SHA256).Hash;
        frontend_path = Join-Path $root 'FrontendAngular/dist/punto-gamer/browser';
        frontend_sha256 = Get-FrontendFingerprint -Path (Join-Path $root 'FrontendAngular/dist/punto-gamer/browser')
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
