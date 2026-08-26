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

- [x] Tabela `public.consulta_cache` criada, RLS ligado, 0 linhas
- [x] Edge function `processo` publicada (`version 1`, `ACTIVE`, `verify_jwt: true`)
- [ ] **Secret `DATAJUD_APIKEY`** — pendente, exige ação manual (ver abaixo)
- [ ] Página no GitHub Pages
- [ ] `Probe-Aliases.ps1` executado

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
