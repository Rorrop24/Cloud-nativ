$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../DeploymentTools.ps1')
$script:fakeAws = Join-Path $PSScriptRoot 'fake-aws.cmd'
function aws { & $script:fakeAws @args }
$result = Invoke-DeploymentAws -Arguments @('success', 'test')
if ($result.Account -ne '123456789012') { throw 'stderr contamino JSON.' }
if ($ErrorActionPreference -ne 'Stop') { throw 'No restauro ErrorActionPreference.' }
foreach ($case in @(@{ command='missing'; code='ParameterNotFound' }, @{ command='denied'; code='AccessDeniedException' })) {
    $caught = $false
    try { Invoke-DeploymentAws -Arguments @($case.command, 'get-parameter') | Out-Null }
    catch { $caught = $_.Exception.Message.Contains($case.code) -and $_.Exception.Message.Contains('exit ') }
    if (!$caught) { throw "No conserva el error AWS $($case.code)." }
}
if ($null -ne (Invoke-DeploymentAws -Arguments @('empty', 'head-bucket'))) { throw 'Respuesta vacia incorrecta.' }
Write-Host "AWS native stderr: 4 casos OK, PowerShell $($PSVersionTable.PSVersion). Cero llamadas AWS."
