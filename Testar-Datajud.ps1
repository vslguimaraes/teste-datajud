<#
.SYNOPSIS
  Testa a API Pública do DataJud (CNJ) para uma lista de processos.
.NOTES
  Trata dois problemas conhecidos:
   1) UTF-8: Windows PowerShell 5.1 decodifica a resposta como Latin-1 e
      corrompe acentos ("PetiÃ§Ã£o"). Aqui a decodificação é forçada.
   2) O array 'movimentos' NÃO vem em ordem cronológica. É ordenado por
      'dataHora' antes de qualquer leitura de status.
#>
[CmdletBinding()]
param(
  [string]$ApiKey = $(if ($env:DATAJUD_APIKEY) { $env:DATAJUD_APIKEY }
                      else { 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==' })
)

$Base = 'https://api-publica.datajud.cnj.jus.br'

$Processos = @(
  @{ Alias = 'trf3'; Numero = '5036221-02.2023.4.03.6100' }
  @{ Alias = 'tjsp'; Numero = '1083208-94.2023.8.26.0053' }
)

# Movimentos que indicam processo encerrado / julgado.
$CodigosBaixa     = @(22)                      # Baixa Definitiva
$CodigosSentenca  = @(193, 196, 219, 220, 471) # sentenças e extinções

function Invoke-DatajudSearch {
    param([string]$Alias, [string]$NumeroDigitos)

    $url  = "$Base/api_publica_$Alias/_search"
    $body = @{ query = @{ match = @{ numeroProcesso = $NumeroDigitos } } } | ConvertTo-Json -Depth 5
    $hdrs = @{ Authorization = "APIKey $ApiKey"; 'Content-Type' = 'application/json' }

    try {
        $resp = Invoke-WebRequest -Uri $url -Method Post -Headers $hdrs `
                    -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) `
                    -TimeoutSec 30 -UseBasicParsing
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "  ERRO HTTP $code : $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }

    # Força UTF-8 — sem isso os acentos vêm corrompidos no PS 5.1.
    $raw = [System.Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
    Write-Host "  HTTP $($resp.StatusCode)"
    return $raw | ConvertFrom-Json
}

foreach ($p in $Processos) {
    $digitos = $p.Numero -replace '\D', ''

    Write-Host ''
    Write-Host ('=' * 70)
    Write-Host "PROCESSO $($p.Numero)  [$($p.Alias)]  ->  $digitos"
    Write-Host ('=' * 70)

    $r = Invoke-DatajudSearch -Alias $p.Alias -NumeroDigitos $digitos
    if (-not $r) { continue }

    $total = $r.hits.total.value
    Write-Host "  Hits: $total"
    if ($total -eq 0) {
        Write-Host '  RESULTADO VAZIO - processo nao encontrado neste tribunal.' -ForegroundColor Yellow
        Write-Host '  Verifique: alias correto? numero correto? processo em segredo de justica?'
        continue
    }

    $src = $r.hits.hits[0]._source

    Write-Host ''
    Write-Host "  Classe        : $($src.classe.nome)"
    Write-Host "  Orgao atual   : $($src.orgaoJulgador.nome)"
    Write-Host "  Grau/Sistema  : $($src.grau) / $($src.sistema.nome)"
    Write-Host "  Ajuizamento   : $($src.dataAjuizamento)"
    Write-Host "  Nivel sigilo  : $($src.nivelSigilo)"
    Write-Host "  Assuntos      : $(($src.assuntos.nome) -join '; ')"

    # A defasagem do indice importa: o DataJud replica em lote, nao em tempo real.
    $atualizacao = [datetime]$src.dataHoraUltimaAtualizacao
    $dias = [int]((Get-Date) - $atualizacao).TotalDays
    Write-Host "  Atualizado em : $($atualizacao.ToString('dd/MM/yyyy')) ($dias dias atras)"
    if ($dias -gt 30) {
        Write-Host "  AVISO: dado com mais de 30 dias. Nao reflete a situacao de hoje." -ForegroundColor Yellow
    }

    # O array vem fora de ordem - ordenar e obrigatorio.
    $movs = $src.movimentos | Sort-Object { [datetime]$_.dataHora }
    Write-Host "  Movimentos    : $($movs.Count)"

    $baixa    = $movs | Where-Object { $CodigosBaixa    -contains $_.codigo } | Select-Object -Last 1
    $sentenca = $movs | Where-Object { $CodigosSentenca -contains $_.codigo } | Select-Object -Last 1

    $status = if ($baixa)         { "ENCERRADO (baixa definitiva em $(([datetime]$baixa.dataHora).ToString('dd/MM/yyyy')))" }
              elseif ($sentenca)  { "SENTENCIADO, sem baixa ($($sentenca.nome) em $(([datetime]$sentenca.dataHora).ToString('dd/MM/yyyy')))" }
              else                { 'ATIVO - sem sentenca nem baixa registradas' }
    Write-Host "  Status        : $status" -ForegroundColor Cyan

    Write-Host ''
    Write-Host '  Ultimos 10 movimentos:'
    $movs | Select-Object -Last 10 | ForEach-Object {
        $c = ($_.complementosTabelados.nome) -join ', '
        $c = if ($c) { " ($c)" } else { '' }
        Write-Host ("    {0}  {1}{2}" -f ([datetime]$_.dataHora).ToString('dd/MM/yyyy HH:mm'), $_.nome, $c)
    }
}
