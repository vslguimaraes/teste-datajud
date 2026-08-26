# Backlog

## 1. Tooltip explicativo nos rótulos (pendente)

**Problema.** Os rótulos das fases são vocabulário jurídico apresentado a um
leitor leigo. "Saneamento" e "Trânsito em julgado" não são autoexplicativos, e
**"Situação atual" é ativamente enganoso**: parece um status do processo, mas é
apenas o movimento mais recente — que frequentemente é um ato de rotina sem
significado nenhum. O leitor pode ler "Situação atual: Recebimento" e achar que
o processo está em alguma fase chamada "recebimento".

**Proposta.** Um `(i)` ao lado de cada rótulo, com o texto abaixo no hover e no
toque (mobile não tem hover — precisa abrir no clique também).

Atenção a dois pontos de acessibilidade que costumam ser esquecidos: o `(i)`
precisa ser focável pelo teclado, e o texto precisa estar associado ao rótulo
via `aria-describedby`, senão leitor de tela não anuncia.

### Textos propostos

| Rótulo | Texto do tooltip |
|---|---|
| **Ajuizamento** | Data em que o processo foi distribuído a uma vara — quando ele passou a existir oficialmente no tribunal. |
| **Primeiro registro** | O tribunal não registrou o ato de distribuição deste processo. Esta é a data do movimento mais antigo que consta na base pública. |
| **Decisão liminar** | Decisão provisória tomada antes do julgamento final, normalmente por urgência. Pode ser mantida ou revista depois. |
| **Saneamento** | Decisão em que o juiz organiza o processo: define os pontos em disputa e quais provas serão produzidas. Marca o fim da fase inicial. |
| **Perícia** | Nomeação de um especialista para examinar um ponto técnico do caso. |
| **Audiência** | Sessão em que partes, testemunhas ou o juiz se reúnem, presencialmente ou por vídeo. |
| **Mudança nas partes** | Alguém entrou ou saiu do processo — por falecimento, sucessão ou substituição. |
| **Sentença** | Decisão do juiz de primeira instância que resolve o caso. Ainda cabe recurso. |
| **Recurso** | Uma das partes pediu que uma instância superior reexamine a decisão. |
| **Decisão em 2º grau** | Julgamento por um colegiado de desembargadores, revendo o que foi decidido em primeira instância. |
| **Julgamento do recurso** | Decisão de mérito proferida na instância recursal. |
| **Trânsito em julgado** | Não cabem mais recursos: a decisão se tornou definitiva. |
| **Arquivamento** | O processo foi encerrado e baixado. Não há mais tramitação. |
| **Situação atual** | O movimento mais recente registrado pelo tribunal. **Não é uma fase do processo** — muitas vezes é um ato de rotina, como uma petição ou uma certidão. Serve para mostrar onde o processo parou. |

### Também merecem tooltip

| Elemento | Texto |
|---|---|
| **Em andamento** | Não há sentença nem arquivamento registrados na base pública. |
| **Julgado** | Há decisão de mérito, mas o processo ainda não foi arquivado. |
| **Baixado** | O processo foi arquivado definitivamente. |
| **Última atualização** | Data em que o tribunal enviou os dados ao DataJud. O envio é feito em lotes, então movimentações posteriores a essa data ainda não aparecem aqui. |
| **ver todos os N** | A lista completa de movimentos, incluindo os atos de expediente que não alteram o rumo do processo. |

### Onde o texto deve morar

Junto do roteiro, em `fases.ts` — cada regra ganha um campo `descricao`, que a
função devolve dentro de `ficha.fases[].descricao`. Assim a explicação viaja
com o dado e qualquer consumidor da API a recebe, não só a nossa página.

---

## 2. Ritos não testados (pendente)

Toda a validação foi feita com processos cíveis. Trabalhista, criminal e
execução fiscal têm arcos diferentes e provavelmente códigos diferentes.

A técnica para investigar sem chutar está descrita em `DEPLOY.md`: perguntar ao
índice quais nomes de movimento existem, antes de escrever a regra.

## 3. Fechar o CORS (pendente)

Secret `ORIGEM_PERMITIDA` = `https://vslguimaraes.github.io`. Hoje aceita
qualquer origem.

## 4. "Situação atual" redundante quando coincide com outra fase — FEITO (version 10)

Em 0091910-41.0000.8.26.0090, `Arquivamento` e `Situação atual` caíram no mesmo
dia. A segunda linha não acrescentava nada — pior, sugeria que o processo
arquivado ainda estava em alguma etapa chamada "recebimento".

A "situação atual" passa a ser dispensada quando o último movimento já é uma
das fases, ou quando cai no mesmo dia da fase mais recente. A vaga liberada
volta para o teto de 8, então processos com muitas fases ganham espaço.
