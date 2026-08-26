<#
.SYNOPSIS
  Testa a edge function 'processo' publicada no Supabase.
.DESCRIPTION
  Roda os quatro casos que importam e confere o cache. Nao depende de curl:
  no PowerShell 'curl' e apelido de Invoke-WebRequest e se comporta diferente.
#>
[CmdletBinding()]
param(
  [string]$BaseUrl   = 'https://edquznquhrcodecmtjlq.supabase.co/functions/v1/processo',
  [string]$ChavePub  = 'sb_publishable_dYJqF9DqwZQHmbaho6TkKQ_uPorMPKh'
)

$hdrs = @{ Authorization = "Bearer $ChavePub" }

function Consultar([string]$numero) {
    try {
        $r = Invoke-WebRequest -Uri "$BaseUrl/$numero" -Headers $hdrs `
                -Method Get -TimeoutSec 60 -UseBasicParsing
        $codigo = $r.StatusCode
        $cache  = $r.Headers['X-Cache']
        # Forca UTF-8: o PS 5.1 decodifica como Latin-1 e corrompe acentos.
        $corpo  = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    } catch {
        $resp = $_.Exception.Response
        if (-not $resp) { Write-Host "  ERRO DE REDE: $($_.Exception.Message)" -ForegroundColor Red; return $null }
        $codigo = $resp.StatusCode.value__
        $cache  = $resp.Headers['X-Cache']
        $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $corpo = $sr.ReadToEnd()
    }
    [pscustomobject]@{ Http = $codigo; Cache = $cache; Json = ($corpo | ConvertFrom-Json) }
}

function Caso([string]$titulo, [string]$numero, [string]$esperado) {
    Write-Host ''
    Write-Host ('-' * 68)
    Write-Host "$titulo"
    Write-Host "  numero   : $numero"
    Write-Host "  esperado : $esperado"
    $r = Consultar $numero
    if (-not $r) { return }

    $bateu = $r.Json.estado -eq $esperado
    $cor = if ($bateu) { 'Green' } else { 'Red' }
    Write-Host "  HTTP $($r.Http)  estado=$($r.Json.estado)  cache=$($r.Cache)" -ForegroundColor $cor

    switch ($r.Json.estado) {
        'encontrado' {
            $f = $r.Json.ficha
            Write-Host "    Classe      : $($f.classe)"
            Write-Host "    Orgao       : $($f.orgaoJulgadorAtual)"
            Write-Host "    Situacao    : $($f.situacaoDescricao)" -ForegroundColor Cyan
            Write-Host "    Movimentos  : $($f.totalMovimentos)"
            Write-Host "    Ultimo      : $($f.ultimoMovimento.data) $($f.ultimoMovimento.nome)"
            Write-Host "    Atualizado  : $($f.atualizadoEm) ($($f.atualizadoHaDias) dias)"
            if ($f.dadoDefasado) { Write-Host "    AVISO: dado defasado" -ForegroundColor Yellow }
        }
        'nao_indexado' {
            Write-Host "    $($r.Json.mensagem)"
            foreach ($c in $r.Json.causasPossiveis) { Write-Host "      - $c" }
        }
        default { Write-Host "    $($r.Json.mensagem)" }
    }
    return $r
}

Write-Host "Testando $BaseUrl"

$a = Caso 'CASO 1  processo que existe (TJSP)' '10832089420238260053' 'encontrado'
$b = Caso 'CASO 2  cache: mesma consulta de novo'  '10832089420238260053' 'encontrado'
Caso 'CASO 3  nao indexado (TRF3)' '50362210220234036100' 'nao_indexado' | Out-Null
Caso 'CASO 4  digito verificador errado' '50362210320234036100' 'numero_invalido' | Out-Null
Caso 'CASO 5  numero curto demais' '123' 'numero_invalido' | Out-Null

Write-Host ''
Write-Host ('=' * 68)
if ($a -and $b) {
    if ($b.Cache -eq 'HIT' -or $b.Json.origemDoDado -eq 'cache') {
        Write-Host 'CACHE FUNCIONANDO: a 2a consulta nao gastou cota do CNJ.' -ForegroundColor Green
    } else {
        Write-Host "CACHE NAO PEGOU (2a veio cache=$($b.Cache) origem=$($b.Json.origemDoDado))." -ForegroundColor Yellow
        Write-Host 'Investigar: a funcao consegue escrever em consulta_cache?'
    }
}
