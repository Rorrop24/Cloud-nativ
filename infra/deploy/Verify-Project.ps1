[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$initialDirectory = Get-Location
try {
    Set-Location -LiteralPath (Join-Path $root 'infra/terraform')
    $outputs = & terraform output -json | Out-String | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or !$outputs.website_url.value) { throw 'El proyecto completo no esta aplicado.' }
    $website = $outputs.website_url.value
    $checks = @(@{ Path = '/'; Status = 200 }, @{ Path = '/catalogo'; Status = 200 },
        @{ Path = '/health/backend'; Status = 200 }, @{ Path = '/health/bff'; Status = 200 }, @{ Path = '/health/cart'; Status = 200 }, @{ Path = '/health/inventory'; Status = 200 }, @{ Path = '/health/notifications'; Status = 200 }, @{ Path = '/health/rabbit-admin'; Status = 200 }, @{ Path = '/health/kafka-admin'; Status = 200 }, @{ Path = '/health/analytics'; Status = 200 }, @{ Path = '/v2/productos/todos'; Status = 200 },
        @{ Path = '/api/bff/me'; Status = 401 }, @{ Path = '/api/rabbitmq/queues/test'; Status = 401 }, @{ Path = '/api/kafka/topics'; Status = 401 },
        @{ Path = '/api/analytics/resumen'; Status = 401 }, @{ Path = '/api/streaming/estado'; Status = 401 })
    Add-Type -AssemblyName System.Net.Http
    $client = New-Object Net.Http.HttpClient
    $client.Timeout = [TimeSpan]::FromSeconds(30)
    try {
        foreach ($check in $checks) {
            $response = $client.GetAsync($website + $check.Path).GetAwaiter().GetResult()
            try {
                if ([int]$response.StatusCode -ne $check.Status) {
                    throw "$($check.Path): esperado $($check.Status), recibido $([int]$response.StatusCode). Revisar cloud-init/ALB."
                }
                Write-Host "$($check.Path): HTTP $($check.Status) OK"
            } finally { $response.Dispose() }
        }
    } finally { $client.Dispose() }
    Write-Host 'Falta probar login Azure, una compra real y los eventos (RabbitMQ: ACK/DLQ; Kafka: topics, grupos y DLT) con una cuenta autorizada.'
} finally { Set-Location -LiteralPath $initialDirectory.Path }
