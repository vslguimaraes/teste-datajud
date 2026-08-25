# Teste da API Pública do DataJud (CNJ)

Script para consultar processos na API pública do DataJud.

## Endpoint

```
POST https://api-publica.datajud.cnj.jus.br/api_publica_{alias}/_search
Authorization: APIKey <chave>
Content-Type: application/json

{"query": {"match": {"numeroProcesso": "<20 dígitos>"}}}
```

## Uso

Bash (Linux/macOS/WSL, requer `jq`):

```bash
./testar_datajud.sh
```

PowerShell (Windows) — recomendado usar PowerShell 7 (`pwsh`):

```powershell
./Testar-Datajud.ps1
```

Chave: por padrão usa a chave pública de teste do CNJ. Para trocar:

```bash
DATAJUD_APIKEY='sua-chave' ./testar_datajud.sh
```

## Processos consultados

| Número                      | Alias | Dígitos                |
|-----------------------------|-------|------------------------|
| 5036221-02.2023.4.03.6100   | trf3  | 50362210220234036100   |
| 1083208-94.2023.8.26.0053   | tjsp  | 10832089420238260053   |

## Armadilhas conhecidas

### 1. Formato do número

O campo `numeroProcesso` é indexado **somente com dígitos** (20 posições, formato
CNJ sem pontuação). Busque `10832089420238260053`, não
`1083208-94.2023.8.26.0053`. O script bash executa as duas formas para tornar a
diferença visível.

### 2. `movimentos` NÃO vem em ordem cronológica

Confirmado no retorno real do TJSP: a posição 1 do array é de 05/12/2023, a
posição 48 é de 26/03/2026 e a posição 49 volta para 04/06/2024. Pegar
`movimentos[-1]` como "último andamento" retorna o movimento errado.
**Sempre ordene por `dataHora`** antes de derivar status. Ambos os scripts
ordenam.

### 3. UTF-8 no Windows PowerShell 5.1

O PS 5.1 decodifica a resposta como Latin-1 e corrompe acentos
(`"PetiÃ§Ã£o"` em vez de `"Petição"`). Não é problema da API. Use `pwsh`
(PowerShell 7) ou decodifique explicitamente:

```powershell
$r = Invoke-WebRequest -Uri $url -Method Post -Headers $h -Body $body -UseBasicParsing
$json = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
```

### 4. O índice é defasado

`dataHoraUltimaAtualizacao` indica quando o tribunal replicou os dados para o
DataJud — pode estar meses atrás do andamento real. Sempre exiba esse campo
junto do status; nunca apresente o resultado como a situação de hoje.

## Determinando o status de um processo

Não existe campo `status` no retorno. Ele é derivado dos movimentos:

- **Baixa Definitiva** (código 22) → processo encerrado.
- Códigos de sentença/extinção (193, 196, 219, 220, 471…) sem baixa → sentenciado,
  ainda tramitando.
- Nenhum dos dois → ativo.

Cuidado: `Conclusão` (51) com complemento "para julgamento" **não** significa que
houve julgamento — só que os autos foram ao magistrado.

## Interpretação dos resultados

- `HTTP 200` + `hits.total.value > 0` → processo encontrado.
- `HTTP 200` + `hits.total.value == 0` → processo não está na base daquele
  tribunal (número errado, alias errado, ou processo em segredo de justiça —
  o DataJud não expõe processos sigilosos).
- `HTTP 401` → chave de API inválida ou header `Authorization` malformado.
- `HTTP 404` → alias de tribunal inexistente (`api_publica_xxxx`).
- `HTTP 429` → limite de requisições excedido.

## Resultado do teste — TJSP (executado em 25/08/2026)

`1083208-94.2023.8.26.0053` → `HTTP 200`, `hits.total.value: 1`,
`_id: TJSP_G1_10832089420238260053`.

| Campo | Valor |
|---|---|
| Classe | Procedimento Comum Cível (cód. 7) |
| Ajuizamento | 05/12/2023 |
| Órgão julgador atual | 13ª Vara da Fazenda Pública de Central (10564) |
| Órgão julgador original | 3ª Vara do Juizado Especial da Fazenda Pública (76603) |
| Assuntos | Repetição de indébito; Invalidez Permanente; CPF |
| Movimentos | 78 |
| Última atualização do índice | 28/04/2026 |
| Status derivado | **Ativo** — sem sentença nem baixa |

Marcos: antecipação de tutela em 09/01/2024; redistribuição do Juizado Especial
para a Vara da Fazenda Pública em 04/06/2024; decisão de saneamento em
21/11/2024; último movimento = conclusão para decisão em 26/03/2026.

## Resultado do teste — TRF3 (executado em 25/08/2026)

`5036221-02.2023.4.03.6100` → `HTTP 200`, `hits.total.value: 0`,
`_shards.failed: 0`, `timed_out: false`.

**Resultado vazio, não erro.** A requisição funcionou; o índice não tem o
documento. Causas descartadas:

- **Número inválido** — descartado. O DV confere pelo módulo 97
  (`validar_numero_cnj.py`).
- **Alias errado** — descartado. `4.03` no número é `J.TR` = Justiça Federal /
  TRF3, e `api_publica_trf3` responde com >10.000 documentos no `match_all`.

Hipóteses restantes, em ordem de probabilidade:

1. **Segredo de justiça.** A API pública só expõe `nivelSigilo: 0`. Processos
   sigilosos retornam 0 hits — indistinguível de "não existe".
2. **Atraso ou lacuna de replicação do TRF3.**
3. Número correto porém transcrito de fonte com erro em outro campo.

### Queries para distinguir

Cobertura da subseção/ano (`6100` = São Paulo/SP, ano 2023):

```json
{"query": {"wildcard": {"numeroProcesso": "*20234036100"}}, "size": 3}
```

Com hits, a cobertura existe e o problema é específico do processo (sigilo);
sem hits, é lacuna de replicação.

Qualquer processo com o mesmo sequencial, em qualquer ano/origem:

```json
{"query": {"prefix": {"numeroProcesso": "5036221"}}, "size": 10}
```

## Validador de número CNJ

Antes de culpar a API, confirme que o número é válido:

```bash
python3 validar_numero_cnj.py "5036221-02.2023.4.03.6100"
```

Calcula o DV pelo módulo 97 (Res. CNJ 65/2008), identifica o segmento da
Justiça e deduz o alias do índice DataJud. Sai com código 1 se algum número
for inválido. Sem argumentos, valida os dois processos deste teste.

## Resumo dos testes

| Processo | Alias | HTTP | Hits | Conclusão |
|---|---|---|---|---|
| 1083208-94.2023.8.26.0053 | tjsp | 200 | 1 | Ativo, sem sentença; última atualização 28/04/2026 |
| 5036221-02.2023.4.03.6100 | trf3 | 200 | 0 | Número válido, índice acessível — não indexado (provável sigilo) |
