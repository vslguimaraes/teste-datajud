# Deploy — beta DataJud

## Projeto Supabase

| | |
|---|---|
| Nome | Prislbr |
| Ref | `edquznquhrcodecmtjlq` |
| URL | `https://edquznquhrcodecmtjlq.supabase.co` |
| Região | sa-east-1 (São Paulo) |
| Dashboard | https://supabase.com/dashboard/project/edquznquhrcodecmtjlq |

Região no Brasil importa: a chamada função→DataJud não atravessa o hemisfério.

## Estado atual

- [x] Tabela `public.consulta_cache` criada, RLS ligado
- [x] Edge function `processo` publicada (`version 9`, `ACTIVE`, `verify_jwt: true`)
- [x] Secret `DATAJUD_APIKEY` configurado
- [x] Página no GitHub Pages: https://vslguimaraes.github.io/teste-datajud/
- [x] 91 aliases validados contra a API real
- [ ] Secret `ORIGEM_PERMITIDA` (opcional — hoje o CORS está em `*`)

### Verificado em produção

| Tribunal | Número | Resultado |
|---|---|---|
| TJSP | `10832089420238260053` | `encontrado`, 78 movimentos, 10 marcos |
| TJSP | `15408666020248260090` | `encontrado` |
| TRF1 | `10145051120244013900` | `encontrado` |
| TRF3 | `50046343320264036301` | `encontrado` |
| TRF3 | `50362210220234036100` | `nao_indexado` |
| TJPE | `00038653320268172730` | `nao_indexado` |

Cache confirmado por `acertos > 0` na tabela: consultas repetidas não tocam o CNJ.

## Configurar o secret (manual)

Não existe ferramenta de API para gravar secrets — tem que ser pelo dashboard.

1. https://supabase.com/dashboard/project/edquznquhrcodecmtjlq/settings/functions
2. **Add new secret**
3. Nome: `DATAJUD_APIKEY`
4. Valor: a chave pública do CNJ (`APIKey ` NÃO faz parte do valor — a função
   monta o prefixo sozinha):

```
cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
```

Sem esse secret a função responde `500 erro_configuracao`.

Opcional, quando a página estiver no ar — restringe quem pode chamar a função:

| Secret | Valor |
|---|---|
| `ORIGEM_PERMITIDA` | `https://vslguimaraes.github.io` |

Sem ele o CORS fica em `*`.

## Chamar a função

`verify_jwt` está ligado, então toda chamada precisa da publishable key:

```bash
curl -s "https://edquznquhrcodecmtjlq.supabase.co/functions/v1/processo/10832089420238260053" \
  -H "Authorization: Bearer sb_publishable_dYJqF9DqwZQHmbaho6TkKQ_uPorMPKh"
```

Publishable key é feita para viver no cliente — pode ficar no HTML. O que
**nunca** pode aparecer na página é a service role key.

### Casos de teste

| Número | Resultado esperado |
|---|---|
| `10832089420238260053` | `encontrado`, situação `em_andamento` |
| `50362210220234036100` | `nao_indexado` com as 3 causas possíveis |
| `5036221-03.2023.4.03.6100` | `400 numero_invalido` (DV errado) |
| `00000000000000000000` | `400 numero_invalido` |

Repita a primeira: a segunda deve vir com `X-Cache: HIT` e `origemDoDado: cache`.

## Estados da resposta

| Estado | HTTP | Significado |
|---|---|---|
| `encontrado` | 200 | Ficha montada |
| `nao_indexado` | 200 | Não está no índice. **Nunca** significa "não existe" |
| `numero_invalido` | 400 | Falhou tamanho ou dígito verificador |
| `tribunal_sem_indice` | 422 | STF/CNJ, ou J.TR inexistente |
| `limite_excedido` | 429 | Cota compartilhada do CNJ estourada |
| `erro_upstream` | 502 | DataJud não respondeu como esperado |
| `erro_configuracao` | 500 | Falta o secret |

## Fases validadas em dado real

As 11 fases do roteiro (`fases.ts`) foram exercitadas com processos reais.
Nenhuma continua baseada apenas na leitura da tabela do CNJ.

| Fase | Processo que a exercitou |
|---|---|
| Ajuizamento | 1083208-94.2023.8.26.0053 |
| Primeiro registro (sem Distribuição) | 0047512-82.2007.8.26.0050 |
| Decisão liminar | 1083208-94.2023.8.26.0053 (tutela) e 1014505-11.2024.4.01.3900 (liminar) |
| Saneamento | 1083208-94.2023.8.26.0053 |
| Perícia | 1014505-11.2024.4.01.3900 |
| Audiência | 0047512-82.2007.8.26.0050 |
| Mudança nas partes | 1014505-11.2024.4.01.3900 |
| Sentença | 1014505-11.2024.4.01.3900 |
| Julgamento do recurso (2º grau) | 0091910-41.0000.8.26.0090 |
| Recurso | 0294316-41.2011.8.26.0000 |
| Decisão em 2º grau | 0294316-41.2011.8.26.0000 (Provimento em Parte) |
| Trânsito em julgado | 0501524-80.2005.8.26.0266 |
| Arquivamento | 0501524-80.2005.8.26.0266 |

### Redução alcançada

| Processo | Movimentos | Fases |
|---|---|---|
| 1014505-11.2024.4.01.3900 | 214 | 6 |
| 0091910-41.0000.8.26.0090 | 142 (G1+G2) | 7 |
| 1083208-94.2023.8.26.0053 | 78 | 4 |
| 0294316-41.2011.8.26.0000 | 75 | 5 |
| 0501524-80.2005.8.26.0266 | 50 | 5 |

A saída não cresce com a entrada: 214 movimentos dão 6 fases, 50 dão 5.

### Descobertas que só o dado real revelou

- Os códigos de expediente mudam por tribunal: Remessa é `123` no TJSP e `982`
  no TRF1; Decurso de Prazo é `1051` no TRF1; Mandado aparece como `106` e
  `985` no mesmo processo.
- `Apelação` não existe como nome de movimento no TJSP — zero processos. Os
  nomes reais são `Recurso ...`, `Acórdão`, `Provimento` e `Não-Provimento`.
- O código `193` (`Julgamento`) vale em qualquer instância, então em documento
  de 2º grau ele é julgamento de recurso, não sentença.
- O campo `grau` assume também o valor `JE` (Juizado Especial).
- Consultas ao índice: use `match` no campo `grau`, não `term` — `term` casa o
  token exato indexado e `G2` é indexado como `g2`.
