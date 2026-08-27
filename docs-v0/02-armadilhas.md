# Armadilhas do DataJud

Comportamentos reais da API que não estão na documentação oficial e que
quebram implementações ingênuas. Todos observados em processos reais.

---

## 1. `movimentos` não vem em ordem cronológica

**A pior armadilha, porque falha silenciosamente.**

Num processo real do TJSP com 78 movimentos, a posição 1 do array era de
`2023-12-05`, a posição 48 era de `2026-03-26` e a posição 49 voltava para
`2024-06-04`.

Quem lê `movimentos[movimentos.length - 1]` como "último andamento" recebe uma
*Remessa de junho/2024* quando o andamento real é uma *Conclusão de
março/2026*. A interface mostra informação errada com aparência de certa.

**Sempre ordenar por `dataHora` antes de qualquer leitura.**

---

## 2. Resultado vazio é ambíguo — nunca diga "não existe"

`HTTP 200` com `hits.total.value: 0` significa uma de três coisas, e **é
impossível distinguir**:

1. O processo tramita em segredo de justiça (filtrado na origem)
2. O tribunal ainda não replicou (processos recentes levam meses)
3. O número é válido na forma mas não corresponde a processo existente

Consequência de produto: a interface deve dizer "não encontrado no índice
público" e listar as três causas. Afirmar "este processo não existe" é
factualmente incorreto e, num contexto jurídico, potencialmente danoso.

---

## 3. Códigos de movimento mudam entre tribunais

O mesmo conceito tem código diferente conforme o tribunal:

| Conceito | TJSP | TRF1 |
|---|---|---|
| Remessa | `123` | `982` |
| Decurso de prazo | — | `1051` |
| Mandado | — | `106` **e** `985` no mesmo processo |

Isso inviabiliza qualquer estratégia de "lista de códigos a ignorar" mantida à
mão: ela seria dialeto de um tribunal e falharia nos outros 90.

---

## 4. Nomes de movimento também variam — e alguns simplesmente não existem

Verificado por consulta ao índice do TJSP:

| Nome buscado | Processos encontrados |
|---|---|
| `Apelação` | **0** |
| `Recurso` | mais de 10.000 |
| `Acórdão` | 3.655 |
| `Provimento` / `Não-Provimento` | mais de 10.000 |

Ou seja: o TJSP **não usa** o nome "Apelação" em movimento nenhum. Uma regra
que dependesse desse termo nunca dispararia, e o defeito seria invisível —
nada quebra, a fase apenas não aparece.

**Regra de trabalho: antes de escrever qualquer regex sobre nome de
movimento, consulte o índice e confirme que o termo existe.** A técnica está
em `01-api-datajud.md`.

---

## 5. O mesmo código significa coisas diferentes conforme o grau

O código `193` chama-se `Julgamento` e vale como decisão de mérito em qualquer
instância. Tratá-lo como "Sentença" produz absurdos em documentos de 2º grau:
um acórdão em 2012 seguido de uma "sentença" em 2026, como se o processo
tivesse retrocedido.

**A interpretação de um movimento depende do campo `grau` do documento em que
ele aparece.**

---

## 6. Duas datas em formatos diferentes no mesmo documento

- `dataAjuizamento`: `"20231205135323"` — compacto, sem separadores
- `dataHoraUltimaAtualizacao` e `movimentos[].dataHora`: ISO 8601

Normalizar os dois para o mesmo formato antes de entregar ao front-end, senão
o consumidor recebe dois formatos na mesma resposta.

---

## 7. `grau` não é só G1 e G2

Valores observados: `G1`, `G2`, `JE` (Juizado Especial). Provavelmente existem
outros (turmas recursais, instâncias superiores). Tratar como enum aberto, com
fallback para exibir o valor cru.

Além disso: um mesmo processo pode existir como **vários documentos**, um por
grau (`TJSP_G1_...` e `TJSP_G2_...`), cada um com seus próprios movimentos e
sua própria data de atualização.

---

## 8. `term` vs `match` em campos de texto

Consultar `{"term": {"grau": "G2"}}` devolve **zero** resultados mesmo havendo
milhares de processos em 2º grau. `term` casa o token exato como indexado, e
num campo de texto analisado "G2" foi indexado como "g2".

`{"match": {"grau": "G2"}}` funciona.

Use `term` apenas em campos numéricos (`movimentos.codigo`) ou keyword.

Essa armadilha é especialmente perigosa em investigação: um `ZERO` faz você
concluir que o dado não existe, quando o erro era da consulta.

---

## 9. O dado é velho, e a defasagem varia por tribunal

Os tribunais enviam ao DataJud em lotes. Defasagem de **120 dias** já foi
observada num TJSP. Processos ajuizados no ano corrente frequentemente ainda
não aparecem.

`dataHoraUltimaAtualizacao` é a data da **replicação**, não do último
andamento processual. Exibir essa data em toda resposta é requisito, não
enfeite: sem ela o usuário acredita estar vendo a situação de hoje.

---

## 10. Encoding UTF-8 em clientes Windows

A resposta é UTF-8. O Windows PowerShell 5.1 decodifica como Latin-1 e produz
`"PetiÃ§Ã£o"` no lugar de `"Petição"`.

Não é problema da API. Duas soluções: enviar `Content-Type` com
`charset=utf-8` na sua própria camada (resolve para clientes que respeitam o
cabeçalho), ou forçar a decodificação no cliente.

---

## 11. O navegador não pode chamar a API diretamente

A API não é feita para consumo em browser, e a chave iria no código-fonte.
Qualquer front-end precisa de uma camada intermediária. Ver
`04-arquitetura.md`.
