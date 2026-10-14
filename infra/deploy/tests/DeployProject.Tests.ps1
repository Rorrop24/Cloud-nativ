$ErrorActionPreference = 'Stop'
$initialDirectory = Get-Location
$previousPassword = $env:TF_VAR_database_password
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('punto-gamer-project-test-' + [guid]::NewGuid())
$global:ProjectMock = @{ account = '123456789012'; version = 1; applies = 0; address = 'aws_instance.application[0]';
    type = 'aws_instance'; name = 'application'; actions = @('create') }

function aws {
    $arguments = $args
    $global:LASTEXITCODE = 0
    if ($arguments[0] -eq 'sts') { return (@{ Account = $global:ProjectMock.account } | ConvertTo-Json -Compress) }
    if ($arguments[1] -eq 'get-parameter') {
        $name = $arguments[[Array]::IndexOf($arguments, '--name') + 1]
        $value = if ($name -eq '/db/password') { 'D' * 40 } else { 'R' * 64 }
        return (@{ Parameter = @{ Type = 'SecureString'; Value = $value; Version = $global:ProjectMock.version } } | ConvertTo-Json -Compress)
    }
    throw 'AWS mock inesperado; no ejecuta AWS real.'
}

function terraform {
    $arguments = $args
    $global:LASTEXITCODE = 0
    switch ($arguments[0]) {
        'init' { return }
        'console' {
            $config = @{ account_id = '123456789012'; region = 'us-east-1'; project = 'punto-gamer'; environment = 'test';
                database_password_path = '/db/password'; rabbit_password_path = '/rabbit/password'; cookie_path = '/rabbit/cookie';
                tenant = 'test'; client = 'test'; audience = 'test' } | ConvertTo-Json -Compress
            return (ConvertTo-Json -InputObject $config -Compress)
        }
        'plan' {
            if ($arguments | Where-Object { $_.StartsWith('-target=') }) { throw 'El plan completo no debe usar target.' }
            if ($env:TF_VAR_database_password -ne ('D' * 40)) { throw 'Password efimera no cargada.' }
            $path = ($arguments | Where-Object { $_.StartsWith('-out=') }).Substring(5)
            [IO.File]::WriteAllText($path, 'Plan ficticio')
            return
        }
        'show' {
            return (@{ resource_changes = @(@{ address = $global:ProjectMock.address; type = $global:ProjectMock.type;
                name = $global:ProjectMock.name; change = @{ actions = $global:ProjectMock.actions } }) } | ConvertTo-Json -Depth 6)
        }
        'apply' { $global:ProjectMock.applies++; return }
        'output' { return '{"website_url":{"value":"https://test.cloudfront.net"}}' }
        default { throw 'Terraform mock inesperado; no ejecuta Terraform real.' }
    }
}

function Assert-Blocked {
    param([scriptblock]$Action, [string]$Expected)
    try { & $Action } catch { if ($_.Exception.Message -notmatch $Expected) { throw }; return }
    throw "Se esperaba bloqueo $Expected"
}

try {
    $deploy = Join-Path $testRoot 'infra/deploy'
    $tf = Join-Path $testRoot 'infra/terraform'
    $frontend = Join-Path $testRoot 'Frontend/dist'
    $artifactDirectory = Join-Path $testRoot 'infra/.deploy'
    foreach ($directory in @($deploy, $tf, $frontend, $artifactDirectory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    foreach ($name in @('Deploy-Project.ps1', 'DeploymentTools.ps1')) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot "../$name") -Destination (Join-Path $deploy $name)
    }
    . (Join-Path $deploy 'DeploymentTools.ps1')
    $archive = Join-Path $artifactDirectory 'application.zip'
    [IO.File]::WriteAllText($archive, 'Fictional archive')
    [IO.File]::WriteAllText((Join-Path $frontend 'index.html'), 'Test')
    $manifest = @{ release_schema = 2; artifact_path = $archive; artifact_sha256 = (Get-FileHash $archive -Algorithm SHA256).Hash;
        frontend_path = $frontend; frontend_sha256 = Get-FrontendFingerprint $frontend }
    [IO.File]::WriteAllText((Join-Path $artifactDirectory 'artifacts.json'), ($manifest | ConvertTo-Json))
    $scriptPath = Join-Path $deploy 'Deploy-Project.ps1'
    $env:TF_VAR_database_password = 'PreviousValue'
    & $scriptPath -Mode Plan -SkipBuild
    & $scriptPath -Mode Apply
    if ($global:ProjectMock.applies -ne 1 -or $env:TF_VAR_database_password -ne 'PreviousValue') { throw 'Apply/entorno incorrectos.' }

    $global:ProjectMock.address = 'aws_db_instance.mysql[0]'
    $global:ProjectMock.type = 'aws_db_instance'
    $global:ProjectMock.actions = @('delete', 'create')
    Assert-Blocked { & $scriptPath -Mode Apply -AllowApplicationReplacement } 'Bloqueado'
    $global:ProjectMock.actions = @('create')
    $global:ProjectMock.version = 2
    Assert-Blocked { & $scriptPath -Mode Apply } 'secreto cambio'
    $global:ProjectMock.version = 1
    $global:ProjectMock.account = '999999999999'
    Assert-Blocked { & $scriptPath -Mode Plan -SkipBuild } 'otra cuenta'
    $global:ProjectMock.account = '123456789012'
    [IO.File]::WriteAllText($archive, 'Altered archive')
    Assert-Blocked { & $scriptPath -Mode Apply } 'archivos cambiaron'
    if ($global:ProjectMock.applies -ne 1) { throw 'No se deben aplicar planes bloqueados.' }
    'Deploy-Project: 5 casos simulados OK; cero llamadas AWS.'
} finally {
    $env:TF_VAR_database_password = $previousPassword
    Remove-Variable ProjectMock -Scope Global
    Set-Location -LiteralPath $initialDirectory.Path
    $resolved = [IO.Path]::GetFullPath($testRoot)
    $allowed = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if ($resolved.StartsWith($allowed, [StringComparison]::OrdinalIgnoreCase) -and
            [IO.Path]::GetFileName($resolved).StartsWith('punto-gamer-project-test-')) {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
