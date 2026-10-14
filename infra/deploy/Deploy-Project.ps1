[CmdletBinding()]
param(
    [ValidateSet('Plan', 'Apply')][string]$Mode = 'Plan',
    [switch]$SkipBuild,
    [switch]$AllowApplicationReplacement
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'DeploymentTools.ps1')
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$terraformDirectory = Join-Path $root 'infra/terraform'
$planPath = Join-Path $terraformDirectory 'project.tfplan'
$metadataPath = Join-Path $terraformDirectory 'project-plan-metadata.json'
$manifestPath = Join-Path $root 'infra/.deploy/artifacts.json'
$initialDirectory = Get-Location
$previousPassword = $env:TF_VAR_database_password

function Get-ProjectParameter {
    param([string]$Name, [string]$Pattern, [int]$RandomBytes, $Configuration)
    try {
        $response = Invoke-DeploymentAws -Arguments @('ssm', 'get-parameter', '--region', $Configuration.region,
            '--name', $Name, '--with-decryption', '--output', 'json')
        if ($response.Parameter.Type -ne 'SecureString' -or $response.Parameter.Value -notmatch $Pattern) {
            throw "SecureString invalido en $Name. No se modifico."
        }
        return $response.Parameter
    } catch {
        if ($Mode -ne 'Plan' -or !$_.Exception.Message.Contains('ParameterNotFound')) { throw }
        if ($Name -eq $Configuration.database_password_path) {
            try {
                Invoke-DeploymentAws -Arguments @('rds', 'describe-db-instances', '--region', $Configuration.region,
                    '--db-instance-identifier', "$($Configuration.project)-$($Configuration.environment)-mysql", '--output', 'json') | Out-Null
                throw 'RDS ya existe pero falta su secreto: recuperar la password, no generar otra.'
            } catch { if (!$_.Exception.Message.Contains('DBInstanceNotFound')) { throw } }
        } else {
            $instances = Invoke-DeploymentAws -Arguments @('ec2', 'describe-instances', '--region', $Configuration.region,
                '--filters', "Name=tag:Name,Values=$($Configuration.project)-$($Configuration.environment)-rabbitmq",
                'Name=instance-state-name,Values=pending,running,stopping,stopped', '--output', 'json')
            if (@($instances.Reservations).Count -gt 0) {
                throw 'Ya existe RabbitMQ pero falta un secreto: recuperar los originales, no regenerarlos.'
            }
        }
        $bytes = New-Object byte[] $RandomBytes
        $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
        $value = [BitConverter]::ToString($bytes).Replace('-', '')
        $directory = New-DeploymentPrivateDirectory
        try {
            $file = Join-Path $directory 'parameter.json'
            [IO.File]::WriteAllText($file, (@{ Name = $Name; Type = 'SecureString'; Value = $value } | ConvertTo-Json -Compress),
                (New-Object Text.UTF8Encoding($false)))
            Invoke-DeploymentAws -Arguments @('ssm', 'put-parameter', '--region', $Configuration.region,
                '--cli-input-json', "file://$file", '--output', 'json') | Out-Null
            Write-Host "SecureString inicial creado en $Name; valor no mostrado."
        } finally { Remove-DeploymentPrivateDirectory -Path $directory }
        return [pscustomobject]@{ Value = $value; Version = 1 }
    }
}

try {
    if ($env:TF_LOG -or $env:TF_LOG_PROVIDER -or $env:TF_LOG_CORE) {
        throw 'Desactivar las trazas Terraform antes de cargar credenciales de RDS.'
    }
    $env:TF_VAR_database_password = $null
    Set-Location -LiteralPath $terraformDirectory
    & terraform init -input=false -no-color
    if ($LASTEXITCODE -ne 0) { throw 'Fallo terraform init.' }
    if ($Mode -eq 'Plan') {
        $configuration = Get-DeploymentConfiguration
    } else {
        $metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
        $configuration = $metadata.configuration
        if ((Get-FileHash $planPath -Algorithm SHA256).Hash -ne $metadata.plan_sha256) { throw 'El plan cambio; regenerarlo.' }
    }
    $identity = Invoke-DeploymentAws -Arguments @('sts', 'get-caller-identity', '--output', 'json')
    if ($identity.Account -ne $configuration.account_id) { throw 'La sesion AWS corresponde a otra cuenta.' }
    $parameters = @{}
    $parameters[$configuration.database_password_path] = Get-ProjectParameter $configuration.database_password_path '^[A-Za-z0-9]{32,41}$' 20 $configuration
    $parameters[$configuration.rabbit_password_path] = Get-ProjectParameter $configuration.rabbit_password_path '^[A-Za-z0-9_-]{32,128}$' 32 $configuration
    $parameters[$configuration.cookie_path] = Get-ProjectParameter $configuration.cookie_path '^[A-Za-z0-9_-]{32,128}$' 32 $configuration
    if ($Mode -eq 'Plan' -and !$SkipBuild) {
        & (Join-Path $PSScriptRoot 'Build-Project.ps1') -TenantId $configuration.tenant -ClientId $configuration.client -Audience $configuration.audience
    }
    $artifacts = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($artifacts.release_schema -ne 2) { throw 'Paquete antiguo: reconstruir Angular y los seis servicios antes de planificar.' }
    if ((Get-FileHash $artifacts.artifact_path -Algorithm SHA256).Hash -ne $artifacts.artifact_sha256 -or
            (Get-FrontendFingerprint $artifacts.frontend_path) -ne $artifacts.frontend_sha256) {
        throw 'Los archivos cambiaron desde la construccion; reconstruir y generar un plan nuevo.'
    }
    $env:TF_VAR_database_password = $parameters[$configuration.database_password_path].Value
    if ($Mode -eq 'Plan') {
        $releaseBucket = Initialize-DeploymentReleaseBucket -Configuration $configuration
        $arguments = @('plan', '-input=false', '-no-color', '-var=enable_application=true', '-var=enable_database=true',
            "-var=application_artifact_path=$($artifacts.artifact_path)", "-var=frontend_dist_path=$($artifacts.frontend_path)", "-out=$planPath")
        if ($releaseBucket) { $arguments += "-var=application_release_bucket_name=$releaseBucket" }
        & terraform @arguments
        if ($LASTEXITCODE -ne 0) { throw 'Fallo el plan del proyecto.' }
        $versions = @{}
        foreach ($name in $parameters.Keys) { $versions[$name] = $parameters[$name].Version }
        $metadata = @{ configuration = $configuration; secret_versions = $versions;
            artifact_sha256 = $artifacts.artifact_sha256; frontend_sha256 = $artifacts.frontend_sha256;
            plan_sha256 = (Get-FileHash $planPath -Algorithm SHA256).Hash }
        [IO.File]::WriteAllText($metadataPath, ($metadata | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding($false)))
        Write-Host 'Plan completo listo en infra/terraform/project.tfplan. Revisar recursos y costos antes de Apply.'
    } else {
        if ($artifacts.artifact_sha256 -ne $metadata.artifact_sha256 -or $artifacts.frontend_sha256 -ne $metadata.frontend_sha256) {
            throw 'El paquete no corresponde al plan guardado.'
        }
        foreach ($name in $parameters.Keys) {
            if ($parameters[$name].Version -ne $metadata.secret_versions.$name) { throw 'Un secreto cambio desde el plan; revisar rotacion.' }
        }
        $plan = & terraform show -json $planPath | Out-String | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo inspeccionar el plan.' }
        foreach ($change in $plan.resource_changes) {
            if ($change.change.actions -contains 'delete') {
                $isRelease = $change.type -eq 'aws_s3_object' -and $change.name -in @('frontend', 'application')
                $isApplication = $change.address -eq 'aws_instance.application[0]' -and $AllowApplicationReplacement
                $isAttachment = $change.type -eq 'aws_lb_target_group_attachment' -and $AllowApplicationReplacement
                if (!$isRelease -and !$isApplication -and !$isAttachment) {
                    throw "El plan borra/reemplaza $($change.address). Bloqueado para proteger RDS, red y RabbitMQ."
                }
            }
        }
        & terraform apply -no-color $planPath
        if ($LASTEXITCODE -ne 0) { throw 'Apply parcial: conservar estado y generar un plan nuevo; no usar destroy.' }
        $outputs = & terraform output -json | Out-String | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw 'No se pudieron leer outputs.' }
        Write-Host "Web: $($outputs.website_url.value)"
        Write-Host "Azure Entra: registra esa URL como Redirect URI de tipo SPA para $($configuration.client)."
        Write-Host 'La creacion de EC2 no confirma cloud-init. Revisar el servicio y probar la web con Verify-Project.ps1.'
    }
} finally {
    $env:TF_VAR_database_password = $previousPassword
    Set-Location -LiteralPath $initialDirectory.Path
}
