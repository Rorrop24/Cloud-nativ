[CmdletBinding()]
param(
    [ValidateSet('Plan', 'Apply')]
    [string]$Mode = 'Plan'
)

$ErrorActionPreference = 'Stop'
$terraformDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../terraform'))
$planPath = Join-Path $terraformDirectory 'database.tfplan'
$metadataPath = Join-Path $terraformDirectory 'database-plan-metadata.json'
$previousPassword = [Environment]::GetEnvironmentVariable('TF_VAR_database_password', 'Process')
$temporaryDirectory = $null
$initialDirectory = Get-Location

function Invoke-AwsJson {
    param([string[]]$Arguments)
    $result = & aws @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "AWS: $($result | Out-String)"
    }
    return (($result | Out-String) | ConvertFrom-Json)
}

function New-PrivateDirectory {
    $path = Join-Path ([IO.Path]::GetTempPath()) ('punto-gamer-db-' + [guid]::NewGuid())
    [IO.Directory]::CreateDirectory($path) | Out-Null
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetOwner($identity)
    $acl.SetAccessRuleProtection($true, $false)
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule(
        $identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    Set-Acl -LiteralPath $path -AclObject $acl
    return $path
}

try {
    Set-Location -LiteralPath $terraformDirectory
    & terraform init -input=false -no-color
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo inicializar Terraform.' }

    if ($Mode -eq 'Plan') {
        # Terraform interpreta HCL; no se extraen valores con expresiones de texto.
        $expression = 'jsonencode({account_id=var.aws_account_id,region=var.aws_region,password_path=local.database_password_path})'
        $encoded = $expression | & terraform console -no-color -var=enable_database=false
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer la configuracion Terraform.' }
        $configuration = (($encoded | Out-String) | ConvertFrom-Json) | ConvertFrom-Json
    } else {
        if (!(Test-Path -LiteralPath $planPath) -or !(Test-Path -LiteralPath $metadataPath)) {
            throw 'Primero ejecuta este script con -Mode Plan y revisa database.tfplan.'
        }
        $configuration = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
        if ((Get-FileHash -LiteralPath $planPath -Algorithm SHA256).Hash -ne $configuration.plan_sha256) {
            throw 'El plan no coincide con sus metadatos; genera un plan nuevo.'
        }
    }

    $identity = Invoke-AwsJson -Arguments @('sts', 'get-caller-identity', '--output', 'json')
    if ($identity.Account -ne $configuration.account_id) {
        throw "La sesion AWS no corresponde a la cuenta $($configuration.account_id)."
    }

    $secret = $null
    try {
        $secret = Invoke-AwsJson -Arguments @(
            'ssm', 'get-parameter', '--region', $configuration.region,
            '--name', $configuration.password_path, '--with-decryption', '--output', 'json')
        if ($secret.Parameter.Type -ne 'SecureString') {
            throw 'El parametro de password existente debe ser SecureString.'
        }
        $password = $secret.Parameter.Value
    } catch {
        if ($Mode -ne 'Plan' -or !$_.Exception.Message.Contains('ParameterNotFound')) { throw }
        $bytes = New-Object byte[] 20
        $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
        $password = [BitConverter]::ToString($bytes).Replace('-', '')
        $temporaryDirectory = New-PrivateDirectory
        $inputPath = Join-Path $temporaryDirectory 'parameter.json'
        $parameter = @{ Name = $configuration.password_path; Type = 'SecureString'; Value = $password }
        [IO.File]::WriteAllText($inputPath, ($parameter | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
        Invoke-AwsJson -Arguments @('ssm', 'put-parameter', '--region', $configuration.region,
            '--cli-input-json', "file://$inputPath", '--output', 'json') | Out-Null
        Write-Host 'Password aleatoria creada y guardada como SecureString; no se mostrara.'
    }

    if ($password -notmatch '^[A-Za-z0-9]{32,41}$') {
        throw 'La credencial MySQL almacenada debe tener entre 32 y 41 letras/numeros. No se ha modificado.'
    }
    if ($Mode -eq 'Apply' -and $secret.Parameter.Version -ne $configuration.secret_version) {
        throw 'El SecureString cambio desde el plan; revisar la rotacion antes de generar un plan nuevo.'
    }
    [Environment]::SetEnvironmentVariable('TF_VAR_database_password', $password, 'Process')

    if ($Mode -eq 'Plan') {
        # Solo esta transicion: evita reemplazar RabbitMQ por cambios previos de user_data.
        $planArguments = @('plan', '-input=false', '-no-color', '-var=enable_database=true',
            '-target=aws_db_instance.mysql', '-target=aws_vpc_security_group_egress_rule.backend', "-out=$planPath")
        & terraform @planArguments
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar el plan RDS.' }
        $metadata = @{ account_id = $configuration.account_id; region = $configuration.region;
            password_path = $configuration.password_path;
            secret_version = $(if ($secret) { $secret.Parameter.Version } else { 1 });
            plan_sha256 = (Get-FileHash -LiteralPath $planPath -Algorithm SHA256).Hash }
        [IO.File]::WriteAllText($metadataPath, ($metadata | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
        Write-Host 'Plan preparado. Revisa terraform show database.tfplan; RDS genera costos.'
        Write-Host 'Para crear los recursos tras revisarlos: .\infra\deploy\Deploy-Database.ps1 -Mode Apply'
    } else {
        $plan = & terraform show -json $planPath | Out-String | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo inspeccionar el plan.' }
        $allowedTypes = @('aws_db_instance', 'aws_db_subnet_group', 'aws_db_parameter_group',
            'aws_subnet', 'aws_route_table', 'aws_route_table_association', 'aws_security_group',
            'aws_vpc_security_group_ingress_rule', 'aws_vpc_security_group_egress_rule', 'aws_vpc', 'random_id')
        foreach ($change in $plan.resource_changes) {
            $actions = $change.change.actions
            if ($actions -contains 'delete') { throw "El plan borra/reemplaza $($change.address); revisar antes de continuar." }
            if (($actions -contains 'create' -or $actions -contains 'update') -and $change.type -notin $allowedTypes) {
                throw "El plan modifica un recurso fuera de la BD: $($change.address)."
            }
        }
        & terraform apply -no-color $planPath
        if ($LASTEXITCODE -ne 0) { throw 'AWS no pudo completar la creacion; conservar el estado y reintentar con un plan nuevo.' }
        Write-Host 'RDS creado. Consulta terraform output database_environment para la conexion sin password.'
    }
} finally {
    [Environment]::SetEnvironmentVariable('TF_VAR_database_password', $previousPassword, 'Process')
    if ($temporaryDirectory -and (Test-Path -LiteralPath $temporaryDirectory)) {
        $resolved = [IO.Path]::GetFullPath($temporaryDirectory)
        $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
        if ($resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and
                [IO.Path]::GetFileName($resolved).StartsWith('punto-gamer-db-')) {
            Remove-Item -LiteralPath $resolved -Recurse -Force
        }
    }
    Set-Location -LiteralPath $initialDirectory.Path
}
