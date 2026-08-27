# DataJud — base de conhecimento para o v0

Documentação da API pública do DataJud (CNJ) e das regras de produto para
construir um consultor de processos judiciais.

Tudo aqui foi **verificado contra a API real**, não deduzido da documentação
oficial. Onde algo permanece hipótese, está marcado como tal.

## Os documentos

| Arquivo | O que responde |
|---|---|
| `01-api-datajud.md` | Como a API funciona: endpoint, autenticação, índices, formato das consultas e das respostas |
| `02-armadilhas.md` | O que quebra em produção e não está na documentação oficial |
| `03-regras-de-negocio.md` | Como transformar o retorno cru em algo legível: status, fases, vocabulário |
| `04-arquitetura.md` | Decisões estruturais e por quê |
| `05-questoes-abertas.md` | Riscos e lacunas conhecidos antes de escalar |

## As cinco coisas que não se pode ignorar

Se o leitor só puder absorver cinco fatos, que sejam estes:

1. **O array `movimentos` NÃO vem em ordem cronológica.** Ler o último
   elemento devolve o andamento errado. Ordenar por `dataHora` sempre.

2. **Resultado vazio é ambíguo.** Processo inexistente, processo em segredo de
   justiça e processo ainda não replicado devolvem os três exatamente
   `HTTP 200` com zero resultados. É impossível distingui-los. A interface
   nunca pode afirmar que um processo não existe.

3. **O dado é velho e a defasagem varia.** Os tribunais replicam em lote. Já
   foram observados 120 dias de atraso. A data de última atualização precisa
   ser exibida junto de qualquer resposta, não escondida no rodapé.

4. **Códigos e nomes de movimento variam por tribunal.** O mesmo conceito tem
   código diferente em tribunais diferentes, e nomes que parecem óbvios podem
   simplesmente não existir. Nunca escrever regra baseada em suposição —
   sempre perguntar ao índice primeiro (ver `02-armadilhas.md`).

5. **A chave de API é pública e compartilhada.** Não há cota própria e o teto
   é desconhecido. Cache não é otimização, é proteção de disponibilidade.

## O que a API é, e o que não é

**É** um espelho em Elasticsearch dos metadados processuais que os tribunais
enviam ao CNJ: número, classe, assuntos, órgão julgador e a lista de
movimentos processuais.

**Não é** o processo. Não há petições, decisões na íntegra, documentos, nomes
de partes nem valores. Para conteúdo, é preciso ir ao sistema do tribunal.
