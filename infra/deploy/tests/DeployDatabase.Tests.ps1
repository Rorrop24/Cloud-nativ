$ErrorActionPreference = 'Stop'
$initialDirectory = Get-Location
$initialPassword = $env:TF_VAR_database_password
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('punto-gamer-deploy-test-' + [guid]::NewGuid())
$global:DeployDatabaseMock = @{ password = 'OnlyAFakePasswordForUnitTests123456';
    exists = $true; account = '123456789012'; expired = $false; secretVersion = 1;
    actions = @('create'); puts = 0; applies = 0 }

# Las funciones sustituyen los ejecutables: ninguna llamada sale a AWS/Terraform.
function aws {
    $arguments = $args
    $global:LASTEXITCODE = 0
    if ($arguments[0] -eq 'sts') {
        if ($global:DeployDatabaseMock.expired) { $global:LASTEXITCODE = 1; return 'ExpiredToken' }
        return (@{ Account = $global:DeployDatabaseMock.account } | ConvertTo-Json -Compress)
    }
    if ($arguments[1] -eq 'get-parameter') {
        if (!$global:DeployDatabaseMock.exists) { $global:LASTEXITCODE = 1; return 'ParameterNotFound' }
        return (@{ Parameter = @{ Type = 'SecureString'; Value = $global:DeployDatabaseMock.password;
                    Version = $global:DeployDatabaseMock.secretVersion } } | ConvertTo-Json -Compress)
    }
    if ($arguments[1] -eq 'put-parameter') {
        if ($arguments -contains '--overwrite') { throw 'No debe sobrescribir el secreto.' }
        $fileArgument = $arguments[[Array]::IndexOf($arguments, '--cli-input-json') + 1]
        $path = $fileArgument.Substring('file://'.Length)
        $acl = Get-Acl -LiteralPath (Split-Path $path -Parent)
        if (!$acl.AreAccessRulesProtected) { throw 'El secreto temporal debe tener ACL privada.' }
        $parameter = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        $global:DeployDatabaseMock.password = $parameter.Value
        $global:DeployDatabaseMock.temporarySecretPath = $path
        $global:DeployDatabaseMock.exists = $true
        $global:DeployDatabaseMock.puts++
        return '{"Version":1}'
    }
    throw "AWS mock inesperado: $($arguments[0]) $($arguments[1])"
}

function terraform {
    $arguments = $args
    $global:LASTEXITCODE = 0
    switch ($arguments[0]) {
        'init' { return }
        'console' {
            $configuration = @{ account_id = '123456789012'; region = 'us-east-1';
                password_path = '/punto-gamer/dev/database/password' } | ConvertTo-Json -Compress
            return (ConvertTo-Json -InputObject $configuration -Compress)
        }
        'plan' {
            if ($env:TF_VAR_database_password -ne $global:DeployDatabaseMock.password) { throw 'Password incorrecta en plan.' }
            if ($arguments -notcontains '-target=aws_db_instance.mysql') { throw 'Debe aislar RDS en esta transicion.' }
            if ($arguments -notcontains '-target=aws_vpc_security_group_egress_rule.backend') { throw 'Debe permitir la conexion saliente del backend.' }
            $path = ($arguments | Where-Object { $_.StartsWith('-out=') }).Substring(5)
            [IO.File]::WriteAllText($path, 'Plan ficticio; no contiene secretos.')
            return
        }
        'show' {
            return (@{ resource_changes = @(@{ address = 'aws_db_instance.mysql[0]';
                type = 'aws_db_instance'; change = @{ actions = $global:DeployDatabaseMock.actions } }) } | ConvertTo-Json -Depth 6)
        }
        'apply' {
            if ($env:TF_VAR_database_password -ne $global:DeployDatabaseMock.password) { throw 'Password incorrecta en apply.' }
            $global:DeployDatabaseMock.applies++
            return
        }
        default { throw "Terraform mock inesperado: $($arguments[0])" }
    }
}

function Assert-Blocked {
    param([scriptblock]$Action, [string]$Expected)
    try { & $Action } catch {
        if ($_.Exception.Message -notmatch $Expected) { throw }
        return
    }
    throw "Se esperaba bloqueo: $Expected"
}

try {
    $deployDirectory = Join-Path $testRoot 'infra/deploy'
    New-Item -ItemType Directory -Path $deployDirectory -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $testRoot 'infra/terraform') | Out-Null
    $scriptPath = Join-Path $deployDirectory 'Deploy-Database.ps1'
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../Deploy-Database.ps1') -Destination $scriptPath
    Set-Location -LiteralPath $testRoot
    $env:TF_VAR_database_password = 'PreviousEnvironmentValue'

    & $scriptPath -Mode Plan
    & $scriptPath -Mode Apply
    if ($global:DeployDatabaseMock.puts -ne 0 -or $global:DeployDatabaseMock.applies -ne 1) { throw 'Debe reutilizar el secreto existente.' }
    if ($env:TF_VAR_database_password -ne 'PreviousEnvironmentValue') { throw 'Debe restaurar el entorno.' }

    $global:DeployDatabaseMock.exists = $false
    & $scriptPath -Mode Plan
    if ($global:DeployDatabaseMock.puts -ne 1 -or (Test-Path -LiteralPath $global:DeployDatabaseMock.temporarySecretPath)) {
        throw 'Debe crear una sola password privada y eliminar el temporal.'
    }
    if ($global:DeployDatabaseMock.password.Length -ne 40) { throw 'La password MySQL debe cumplir el limite RDS.' }
    $metadata = Get-Content 'infra/terraform/database-plan-metadata.json' -Raw
    if ($metadata.Contains($global:DeployDatabaseMock.password)) { throw 'Los metadatos no deben contener secretos.' }

    $global:DeployDatabaseMock.actions = @('delete', 'create')
    Assert-Blocked { & $scriptPath -Mode Apply } 'borra/reemplaza'
    $global:DeployDatabaseMock.actions = @('create')
    $global:DeployDatabaseMock.secretVersion = 2
    Assert-Blocked { & $scriptPath -Mode Apply } 'SecureString cambio'
    $global:DeployDatabaseMock.secretVersion = 1
    $global:DeployDatabaseMock.account = '999999999999'
    Assert-Blocked { & $scriptPath -Mode Plan } 'no corresponde'
    $global:DeployDatabaseMock.account = '123456789012'
    $global:DeployDatabaseMock.expired = $true
    Assert-Blocked { & $scriptPath -Mode Plan } 'ExpiredToken'
    if ($global:DeployDatabaseMock.applies -ne 1) { throw 'No debe aplicar planes bloqueados.' }
    'Deploy-Database: 6 casos simulados OK (cero llamadas AWS).'
} finally {
    $env:TF_VAR_database_password = $initialPassword
    Remove-Variable DeployDatabaseMock -Scope Global
    Set-Location -LiteralPath $initialDirectory.Path
    $resolved = [IO.Path]::GetFullPath($testRoot)
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if ($resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and
            [IO.Path]::GetFileName($resolved).StartsWith('punto-gamer-deploy-test-')) {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
