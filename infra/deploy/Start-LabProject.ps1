[CmdletBinding()]
param(
    [switch]$AllowApplicationReplacement,
    [switch]$SkipBuild,
    [int]$WaitSeconds = 900
)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$initialDirectory = Get-Location
$previousPath = $env:PATH
try {
    Set-Location -LiteralPath $root
    $portableCli = Join-Path $root 'infra/.deploy/tools/bin'
    if (!(Get-Command aws -ErrorAction SilentlyContinue) -and
            (Test-Path -LiteralPath (Join-Path $portableCli 'aws.cmd'))) {
        $env:PATH = "$portableCli;$env:PATH"
    }
    foreach ($command in @('aws', 'terraform')) {
        if (!(Get-Command $command -ErrorAction SilentlyContinue)) {
            throw "Falta $command en esta terminal. Inicia desde la terminal autenticada que tiene AWS CLI."
        }
    }
    . (Join-Path $PSScriptRoot 'DeploymentTools.ps1')
    $identity = Invoke-DeploymentAws -Arguments @('sts', 'get-caller-identity', '--output', 'json')
    Write-Host "Sesion AWS comprobada: cuenta $($identity.Account)."
    $tfvars = Join-Path $root 'infra/terraform/terraform.tfvars'
    if (!(Test-Path -LiteralPath $tfvars)) { throw 'Falta terraform.tfvars; conservar el estado original.' }
    if ((Get-Content -LiteralPath $tfvars -Raw) -notmatch '(?m)^\s*existing_instance_profile_name\s*=\s*"LabInstanceProfile"') {
        throw 'Esta receta requiere existing_instance_profile_name = "LabInstanceProfile".'
    }
    $profile = Invoke-DeploymentAws -Arguments @('iam', 'get-instance-profile', '--instance-profile-name', 'LabInstanceProfile', '--output', 'json')
    if (!$profile.InstanceProfile.Roles -or @($profile.InstanceProfile.Roles).Count -eq 0) {
        throw 'LabInstanceProfile no tiene un rol asociado.'
    }
    $state = Join-Path $root 'infra/terraform/terraform.tfstate'
    if (Test-Path -LiteralPath $state) {
        $backupDirectory = Join-Path $root 'infra/.deploy/state-backups'
        New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
        Copy-Item -LiteralPath $state -Destination (Join-Path $backupDirectory ("terraform-{0}.tfstate" -f (Get-Date -Format 'yyyyMMdd-HHmmss')))
    }
    $planArguments = @{ Mode = 'Plan' }
    if ($SkipBuild) { $planArguments.SkipBuild = $true }
    & (Join-Path $PSScriptRoot 'Deploy-Project.ps1') @planArguments

    $planText = & terraform -chdir=infra/terraform show -json project.tfplan | Out-String
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo revisar el plan generado.' }
    $plan = $planText | ConvertFrom-Json
    foreach ($change in $plan.resource_changes) {
        $actions = @($change.change.actions)
        if ($change.type -like 'aws_iam_*' -and $actions -contains 'create') {
            throw "El plan aun intenta crear IAM: $($change.address). No se aplico."
        }
        if ($actions -contains 'delete') {
            $release = $change.type -eq 'aws_s3_object' -and $change.name -in @('frontend', 'application')
            $application = $AllowApplicationReplacement -and ($change.address -eq 'aws_instance.application[0]' -or $change.type -eq 'aws_lb_target_group_attachment')
            if (!$release -and !$application) { throw "Plan bloqueado: elimina o reemplaza $($change.address). No se aplico." }
        }
        if ($actions -notcontains 'no-op' -and $actions -notcontains 'read') {
            Write-Host "$($change.address): $($actions -join ', ')"
        }
    }
    Write-Host 'Plan comprobado: sin creacion de IAM ni borrado de RDS, RabbitMQ o red. Aplicando despliegue autorizado.'
    $applyArguments = @{ Mode = 'Apply' }
    if ($AllowApplicationReplacement) { $applyArguments.AllowApplicationReplacement = $true }
    & (Join-Path $PSScriptRoot 'Deploy-Project.ps1') @applyArguments

    $outputsText = & terraform -chdir=infra/terraform output -json | Out-String
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron consultar outputs.' }
    $outputs = $outputsText | ConvertFrom-Json
    $website = $outputs.website_url.value
    $region = (Get-Content -LiteralPath 'infra/terraform/project-plan-metadata.json' -Raw | ConvertFrom-Json).configuration.region
    Write-Host "Esperando el arranque de $website (hasta $WaitSeconds segundos)..."
    $deadline = [DateTime]::UtcNow.AddSeconds($WaitSeconds)
    Add-Type -AssemblyName System.Net.Http
    $client = New-Object Net.Http.HttpClient
    $client.Timeout = [TimeSpan]::FromSeconds(15)
    $ready = $false
    try {
        do {
            try {
                $response = $client.GetAsync($website + '/v2/productos/todos').GetAwaiter().GetResult()
                try {
                    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                    $ready = [int]$response.StatusCode -eq 200 -and $body.TrimStart().StartsWith('[')
                    Write-Host "Catalogo: HTTP $([int]$response.StatusCode)."
                } finally { $response.Dispose() }
            } catch { Write-Host 'La aplicacion aun no responde.' }
            if (!$ready -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Seconds 20 }
        } while (!$ready -and [DateTime]::UtcNow -lt $deadline)
    } finally { $client.Dispose() }
    if (!$ready) {
        Write-Host 'Diagnostico del target ALB:'
        & aws elbv2 describe-target-health --region $region --target-group-arn $outputs.application_target_group_arn.value
        Write-Host "Entrar a EC2: $($outputs.application_session_command.value)"
        throw 'No se confirmo el arranque. Conservar estado; revisar cloud-init y contenedores. No usar destroy.'
    }
    & (Join-Path $PSScriptRoot 'Verify-Project.ps1')
    Write-Host "Web verificada: $website"
    Write-Host 'Para completar login, registrar ese origen como Redirect URI SPA en Azure; la automatizacion AWS no cambia Azure.'
} finally { $env:PATH = $previousPath; Set-Location -LiteralPath $initialDirectory.Path }
