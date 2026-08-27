# A API pública do DataJud

## O essencial

```
POST https://api-publica.datajud.cnj.jus.br/api_publica_{alias}/_search
Authorization: APIKey {chave}
Content-Type: application/json
```

É um Elasticsearch exposto diretamente. O corpo da requisição é uma query
Elasticsearch e a resposta é a resposta nativa do Elasticsearch — com
`hits.total.value`, `hits.hits[]._source` e tudo mais.

Não é uma API REST desenhada para consumo: é um índice de busca aberto ao
público. Isso tem consequências boas (dá para agregar, filtrar, explorar) e
ruins (nada é validado ou traduzido para você).

## Autenticação

A chave é **pública e a mesma para todos**. O CNJ a publica na documentação:

```
cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
```

O prefixo `APIKey ` faz parte do cabeçalho, não do valor.

Implicação prática: **não existe cota individual**. O consumo é compartilhado
com todos os consumidores do país, o teto não é documentado e um pico de uso
alheio pode derrubar sua aplicação. Ver `04-arquitetura.md`.

## Um índice por tribunal, deduzido do número

Cada tribunal tem seu índice: `api_publica_tjsp`, `api_publica_trf3`, etc.
São **91 índices**, todos confirmados existentes.

O usuário não precisa escolher o tribunal, porque o próprio número CNJ carrega
essa informação. No formato `NNNNNNN-DD.AAAA.J.TR.OOOO`:

- `J` = segmento da Justiça
- `TR` = tribunal dentro do segmento

### Tabela de roteamento

| J | Segmento | Alias |
|---|---|---|
| 1 | STF | **não existe** na API pública |
| 2 | CNJ | **não existe** na API pública |
| 3 | STJ | `stj` |
| 4 | Justiça Federal | `trf1` … `trf6` (TR = 01–06) |
| 5 | Justiça do Trabalho | `trt1` … `trt24`; `tst` quando TR = 00 |
| 6 | Justiça Eleitoral | `tre-ac` … `tre-to`; `tse` quando TR = 00 |
| 7 | Justiça Militar da União | `stm` |
| 8 | Justiça Estadual | `tjac` … `tjto` — atenção: DF é `tjdft`, não `tjdf` |
| 9 | Justiça Militar Estadual | só `tjmmg`, `tjmrs`, `tjmsp` |

Estadual, Eleitoral e Militar Estadual usam a **mesma tabela de UF** por
código TR: `01`=AC, `02`=AL, `03`=AP, `04`=AM, `05`=BA, `06`=CE, `07`=DF,
`08`=ES, `09`=GO, `10`=MA, `11`=MT, `12`=MS, `13`=MG, `14`=PA, `15`=PB,
`16`=PR, `17`=PE, `18`=PI, `19`=RJ, `20`=RN, `21`=RS, `22`=RO, `23`=RR,
`24`=SC, `25`=SE, `26`=SP, `27`=TO.

## Validar o número antes de consultar

O dígito verificador usa módulo 97 base 10 (ISO 7064), conforme a Res. CNJ
65/2008:

```
DV = 98 - ( NNNNNNN AAAA J TR OOOO 00  mod  97 )
```

Atenção: o número montado tem 20 dígitos e **estoura a precisão de um Number
do JavaScript**. Calcular o resto incrementalmente, dígito a dígito.

Validar no cliente antes de chamar a API economiza requisições da cota
compartilhada e dá erro imediato para o usuário.

## A consulta por número

O campo `numeroProcesso` é indexado **somente com os 20 dígitos**, sem
pontuação. Buscar com máscara devolve zero resultados.

```json
{ "query": { "match": { "numeroProcesso": "10832089420238260053" } }, "size": 10 }
```

`size: 10` porque um mesmo processo pode existir como vários documentos, um
por grau de jurisdição.

## O que vem na resposta

```json
{
  "hits": {
    "total": { "value": 1 },
    "hits": [{
      "_id": "TJSP_G1_10832089420238260053",
      "_source": {
        "numeroProcesso": "10832089420238260053",
        "tribunal": "TJSP",
        "grau": "G1",
        "nivelSigilo": 0,
        "dataAjuizamento": "20231205135323",
        "dataHoraUltimaAtualizacao": "2026-04-28T04:55:55.885000Z",
        "classe":  { "codigo": 7, "nome": "Procedimento Comum Cível" },
        "sistema": { "codigo": 3, "nome": "SAJ" },
        "formato": { "codigo": 1, "nome": "Eletrônico" },
        "orgaoJulgador": { "codigo": 10564, "nome": "13 FAZENDA PUBLICA DE CENTRAL" },
        "assuntos": [{ "codigo": 6007, "nome": "Repetição de indébito" }],
        "movimentos": [{
          "codigo": 26,
          "nome": "Distribuição",
          "dataHora": "2023-12-05T14:13:28.000Z",
          "orgaoJulgador": { "codigo": "76603", "nome": "..." },
          "complementosTabelados": [
            { "codigo": 2, "valor": 2, "nome": "sorteio",
              "descricao": "tipo_de_distribuicao_redistribuicao" }
          ]
        }]
      }
    }]
  }
}
```

### Campos que importam

| Campo | Observação |
|---|---|
| `grau` | `G1`, `G2`, `JE` (Juizado Especial) e outros. **Não é só G1/G2.** |
| `nivelSigilo` | Sempre 0 na base pública — os sigilosos são filtrados na origem |
| `dataAjuizamento` | Formato compacto `AAAAMMDDHHMMSS`, diferente das demais datas |
| `dataHoraUltimaAtualizacao` | Quando o tribunal replicou, **não** quando o processo andou |
| `movimentos` | Lista fora de ordem cronológica — ver `02-armadilhas.md` |
| `movimentos[].codigo` | Código da Tabela Processual Unificada (TPU) do CNJ |
| `complementosTabelados` | Qualificam o movimento: "para decisão", "sorteio", "Certidão" |

Não existe campo de **status**. Ele precisa ser derivado — ver
`03-regras-de-negocio.md`.

## Explorar o índice

Como é Elasticsearch cru, dá para investigar antes de escrever regra. Isso é
a técnica mais valiosa deste documento:

```json
// quantos documentos o índice tem, sem baixar nenhum
{ "query": { "match_all": {} }, "size": 0 }

// existe algum processo com este nome de movimento?
{ "query": { "match_phrase": { "movimentos.nome": "Trânsito em julgado" } },
  "size": 2, "_source": ["numeroProcesso", "grau"] }

// existe algum processo em 2º grau?
{ "query": { "match": { "grau": "G2" } }, "size": 2 }

// existe algum processo com este código de movimento?
{ "query": { "term": { "movimentos.codigo": 22 } }, "size": 2 }
```

**Antes de escrever qualquer regra baseada em nome ou código de movimento,
consulte o índice para confirmar que aquele nome existe naquele tribunal.**
Nomes que parecem óbvios podem não existir (ver `02-armadilhas.md`).

## Códigos de erro

| HTTP | Significado |
|---|---|
| 200 + `hits: 0` | **Ambíguo.** Não existe, é sigiloso, ou não foi replicado |
| 401 | Chave inválida ou cabeçalho malformado |
| 404 | Alias de índice inexistente |
| 429 | Cota compartilhada excedida |
