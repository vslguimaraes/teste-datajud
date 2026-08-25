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

```bash
./testar_datajud.sh
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

## Observação importante sobre o formato do número

O campo `numeroProcesso` é indexado **somente com dígitos** (20 posições, formato
CNJ sem pontuação). Uma busca `match` com o número mascarado
(`5036221-02.2023.4.03.6100`) tende a retornar `hits.total.value: 0`.
O script executa as duas formas para deixar essa diferença visível.

## Interpretação dos resultados

- `HTTP 200` + `hits.total.value > 0` → processo encontrado.
- `HTTP 200` + `hits.total.value == 0` → processo não está na base daquele
  tribunal (número errado, alias errado, ou processo em segredo de justiça —
  o DataJud não expõe processos sigilosos).
- `HTTP 401` → chave de API inválida ou header `Authorization` malformado.
- `HTTP 404` → alias de tribunal inexistente (`api_publica_xxxx`).
- `HTTP 429` → limite de requisições excedido.
