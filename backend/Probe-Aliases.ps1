<#
.SYNOPSIS
  Verifica quais aliases do DataJud realmente existem.
.DESCRIPTION
  Faz um _search com size=0 em cada indice hipotetico. Nao traz documentos -
  so confirma se o indice responde. Grava aliases_confirmados.json.

  Necessario porque a convencao de nome dos aliases (hifen, sufixo, numeracao)
  nao esta documentada de forma confiavel: 'tre-sp' pode ser 'tresp', TRT pode
  ser 'trt1' ou 'trt01'. Melhor perguntar a API do que chutar em producao.
#>
[CmdletBinding()]
param(
  [string]$ApiKey = $(if ($env:DATAJUD_APIKEY) { $env:DATAJUD_APIKEY }
                      else { 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==' }),
  [int]$DelayMs = 300,          # gentileza com a cota compartilhada do CNJ
  [string]$Saida = 'aliases_confirmados.json'
)

$Base = 'https://api-publica.datajud.cnj.jus.br'

$Aliases = @(
    'stj',
    'stm',
    'tjac',
    'tjal',
    'tjam',
    'tjap',
    'tjba',
    'tjce',
    'tjdft',
    'tjes',
    'tjgo',
    'tjma',
    'tjmg',
    'tjmmg',
    'tjmrs',
    'tjms',
    'tjmsp',
    'tjmt',
    'tjpa',
    'tjpb',
    'tjpe',
    'tjpi',
    'tjpr',
    'tjrj',
    'tjrn',
    'tjro',
    'tjrr',
    'tjrs',
    'tjsc',
    'tjse',
    'tjsp',
    'tjto',
    'tre-ac',
    'tre-al',
    'tre-am',
    'tre-ap',
    'tre-ba',
    'tre-ce',
    'tre-df',
    'tre-es',
    'tre-go',
    'tre-ma',
    'tre-mg',
    'tre-ms',
    'tre-mt',
    'tre-pa',
    'tre-pb',
    'tre-pe',
    'tre-pi',
    'tre-pr',
    'tre-rj',
    'tre-rn',
    'tre-ro',
    'tre-rr',
    'tre-rs',
    'tre-sc',
    'tre-se',
    'tre-sp',
    'tre-to',
    'trf1',
    'trf2',
    'trf3',
    'trf4',
    'trf5',
    'trf6',
    'trt1',
    'trt10',
    'trt11',
    'trt12',
    'trt13',
    'trt14',
    'trt15',
    'trt16',
    'trt17',
    'trt18',
    'trt19',
    'trt2',
    'trt20',
    'trt21',
    'trt22',
    'trt23',
    'trt24',
    'trt3',
    'trt4',
    'trt5',
    'trt6',
    'trt7',
    'trt8',
    'trt9',
    'tse',
    'tst'
)

$hdrs = @{ Authorization = "APIKey $ApiKey"; 'Content-Type' = 'application/json' }
$body = [System.Text.Encoding]::UTF8.GetBytes('{"query":{"match_all":{}},"size":0}')

$ok = [System.Collections.Generic.List[object]]::new()
$falhou = [System.Collections.Generic.List[object]]::new()
$i = 0

foreach ($a in $Aliases) {
    $i++
    Write-Progress -Activity 'Verificando aliases DataJud' -Status $a -PercentComplete ($i / $Aliases.Count * 100)
    try {
        $r = Invoke-WebRequest -Uri "$Base/api_publica_$a/_search" -Method Post `
                -Headers $hdrs -Body $body -TimeoutSec 30 -UseBasicParsing
        $j = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
        $total = $j.hits.total.value
        $ok.Add([pscustomobject]@{ alias = $a; documentos = $total })
        Write-Host ("  OK    {0,-10} {1,12:N0} docs" -f $a, $total) -ForegroundColor Green
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $falhou.Add([pscustomobject]@{ alias = $a; http = $code })
        Write-Host ("  FALHA {0,-10} HTTP {1}" -f $a, $code) -ForegroundColor DarkYellow
    }
    Start-Sleep -Milliseconds $DelayMs
}
Write-Progress -Activity 'Verificando aliases DataJud' -Completed

Write-Host ''
Write-Host "Confirmados: $($ok.Count) / $($Aliases.Count)" -ForegroundColor Cyan
if ($falhou.Count) {
    Write-Host "Falharam   : $(($falhou.alias) -join ', ')" -ForegroundColor Yellow
    Write-Host 'HTTP 404 = alias nao existe com esse nome (precisa corrigir a tabela).'
    Write-Host 'HTTP 429 = rate limit; aumente -DelayMs e rode de novo so os que falharam.'
}

[pscustomobject]@{
    verificadoEm = (Get-Date).ToString('o')
    confirmados  = $ok
    falharam     = $falhou
} | ConvertTo-Json -Depth 5 | Set-Content -Path $Saida -Encoding UTF8

Write-Host "Resultado salvo em $Saida"
