$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../DeploymentTools.ps1')
$script:calls = @()
$script:headError = $null
function Invoke-DeploymentAws {
    param([string[]]$Arguments)
    $script:calls += ,$Arguments
    if ($Arguments[1] -eq 'head-bucket' -and $script:headError) { throw $script:headError }
    return $null
}
$configuration = [pscustomobject]@{ account_id = '123456789012'; region = 'us-east-1'; project = 'punto-gamer';
    environment = 'test'; learner_lab = $true; release_bucket = 'existing-private-bucket' }
$bucket = Initialize-DeploymentReleaseBucket $configuration
if ($bucket -ne 'existing-private-bucket' -or $script:calls.Count -ne 1) { throw 'Debe reutilizar sin crear.' }
$script:calls = @()
$script:headError = 'AWS: (404) Not Found'
$configuration.release_bucket = $null
$configuration.region = 'us-west-2'
$bucket = Initialize-DeploymentReleaseBucket $configuration
if ($script:calls.Count -ne 2 -or $script:calls[1] -notcontains 'LocationConstraint=us-west-2' -or
    $bucket -ne 'punto-gamer-test-releases-123456789012-us-west-2') { throw 'Creacion/regionalizacion incorrecta.' }
$script:calls = @()
$script:headError = 'AWS: AccessDenied (403)'
$blocked = $false
try { Initialize-DeploymentReleaseBucket $configuration } catch { $blocked = $_.Exception.Message -match 'AccessDenied' }
if (!$blocked -or $script:calls.Count -ne 1) { throw 'AccessDenied debe propagarse sin intentar crear.' }
'Release bucket: 3 casos simulados OK; cero llamadas AWS.'
