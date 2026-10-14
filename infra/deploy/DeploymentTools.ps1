function Invoke-DeploymentAws {
    param([string[]]$Arguments)
    $result = & aws @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "AWS: $($result | Out-String)" }
    return (($result | Out-String) | ConvertFrom-Json)
}

function Get-DeploymentConfiguration {
    $expression = 'jsonencode({account_id=var.aws_account_id,region=var.aws_region,project=var.project_name,environment=var.environment,database_password_path=local.database_password_path,rabbit_password_path=local.password_path,cookie_path=local.cookie_path,tenant=var.azure_tenant_id,client=var.azure_frontend_client_id,audience=var.azure_api_audience,release_bucket=var.application_release_bucket_name,learner_lab=var.existing_instance_profile_name=="LabInstanceProfile"})'
    $encoded = $expression | & terraform console -no-color -var=enable_application=false -var=enable_database=false
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer la configuracion Terraform.' }
    return ((($encoded | Out-String) | ConvertFrom-Json) | ConvertFrom-Json)
}

function Initialize-DeploymentReleaseBucket {
    param($Configuration)
    $bucket = $Configuration.release_bucket
    if (!$bucket -and !$Configuration.learner_lab) { return $null }
    if (!$bucket) { $bucket = "$($Configuration.project)-$($Configuration.environment)-releases-$($Configuration.account_id)-$($Configuration.region)" }
    try {
        Invoke-DeploymentAws -Arguments @('s3api', 'head-bucket', '--bucket', $bucket,
            '--expected-bucket-owner', $Configuration.account_id, '--region', $Configuration.region) | Out-Null
    } catch {
        if ($_.Exception.Message -notmatch '\(404\)|NoSuchBucket|Not Found') { throw }
        $arguments = @('s3api', 'create-bucket', '--bucket', $bucket, '--region', $Configuration.region)
        if ($Configuration.region -ne 'us-east-1') {
            $arguments += @('--create-bucket-configuration', "LocationConstraint=$($Configuration.region)")
        }
        Invoke-DeploymentAws -Arguments $arguments | Out-Null
        Write-Host "Bucket privado de entregas creado: $bucket. Se conserva fuera del recurso aws_s3_bucket."
    }
    return $bucket
}

function New-DeploymentPrivateDirectory {
    $path = Join-Path ([IO.Path]::GetTempPath()) ('punto-gamer-secret-' + [guid]::NewGuid())
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

function Remove-DeploymentPrivateDirectory {
    param([string]$Path)
    $resolved = [IO.Path]::GetFullPath($Path)
    $root = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (!$resolved.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or
            ![IO.Path]::GetFileName($resolved).StartsWith('punto-gamer-secret-')) {
        throw 'Ruta temporal fuera del directorio permitido.'
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}

function Get-FrontendFingerprint {
    param([string]$Path)
    $root = [IO.Path]::GetFullPath($Path).TrimEnd('\') + '\'
    $lines = Get-ChildItem -LiteralPath $root -File -Recurse | Sort-Object FullName | ForEach-Object {
        $_.FullName.Substring($root.Length).Replace('\', '/') + ':' +
            (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    }
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        return [BitConverter]::ToString($algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($lines -join "`n"))).Replace('-', '')
    } finally { $algorithm.Dispose() }
}
