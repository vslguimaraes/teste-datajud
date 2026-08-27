# Regras de negócio

Como transformar o retorno cru do DataJud em algo que um cliente leigo
entenda. Este é o valor do produto — a API já existe e é pública; o que não
existe é a leitura.

## O problema que o produto resolve

O DataJud devolve uma lista de movimentos processuais em vocabulário técnico,
fora de ordem, sem status, e cujo tamanho cresce com a idade do processo. Um
processo de 2024 no TRF1 tem **214 movimentos**; um de 2005 no TJSP tem 50.

Nenhum cliente lê 214 linhas de "Expedida/Certificada" e "Decurso de Prazo".
Ele quer saber três coisas:

1. Meu processo está vivo?
2. O que aconteceu de importante?
3. Isso está atualizado?

Toda regra abaixo existe para responder essas três perguntas.

---

## Regra 1 — Situação: três valores, derivados

Não há campo de status na API. Ele é derivado dos movimentos, na ordem:

| Situação | Condição |
|---|---|
| **Baixado** | Existe movimento de baixa definitiva (código `22` ou nome equivalente) |
| **Julgado** | Existe movimento de julgamento/mérito, mas não há baixa |
| **Em andamento** | Nenhum dos dois |

Atenção: `Conclusão` com complemento "para julgamento" **não** é julgamento —
significa apenas que os autos foram ao magistrado. Confundir os dois marca
como julgado um processo que não foi.

---

## Regra 2 — Linha do tempo: roteiro fixo, não filtro de ruído

### A abordagem que não funciona

O impulso natural é filtrar: "mostre tudo que não for expediente". Ela falha
por dois motivos:

1. **A saída cresce com a entrada.** 78 movimentos → 10 destaques;
   214 movimentos → 93 destaques. Quanto mais movimentado o processo, mais
   itens na tela — exatamente o inverso do necessário.
2. **Exige manter lista de exclusão por tribunal**, porque os códigos de
   expediente variam (ver `02-armadilhas.md`).

### A abordagem que funciona

Um **roteiro fixo de fases** — o arco que todo processo percorre — com no
máximo um evento por fase. A saída fica presa ao tamanho do roteiro, não ao do
processo.

| Fase | Casa com |
|---|---|
| **Ajuizamento** | Distribuição, Redistribuição (códigos 26, 36) — usa a **primeira** ocorrência |
| **Decisão liminar** | códigos 332, 792; nomes com "liminar", "antecipação de tutela" |
| **Saneamento** | código 12387; nome com "saneamento" |
| **Perícia** | código 12306; nomes com "perícia", "perito" |
| **Audiência** | nome com "audiência" |
| **Mudança nas partes** | códigos 268, 12308; morte, sucessão, substituição |
| **Sentença** | códigos de mérito (193, 219, 220, 221, 11795…); nomes com "sentença", "procedência", "extinção" |
| **Recurso** | nomes com "recurso", "agravo", "embargos de declaração" |
| **Decisão em 2º grau** | nomes com "acórdão", "provimento", "não-provimento" |
| **Trânsito em julgado** | nome com "trânsito em julgado" |
| **Arquivamento** | código 22; "baixa definitiva" |

Três regras que valem sempre:

- **Teto de 8 itens.** Acima disso a leitura vira lista de novo.
- **A linha do tempo sempre começa em algum lugar.** Se nenhum movimento for
  Distribuição, o primeiro registro assume o papel, rotulado como
  "Primeiro registro". Existem processos sem movimento de distribuição.
- **O último movimento entra como "Situação atual"** quando acrescenta algo —
  ou seja, quando não é ele próprio uma fase e não caiu no mesmo dia da fase
  mais recente.

### Rótulo depende do grau

Em instância recursal (`G2` e superiores), a fase "Sentença" é rotulada
**"Julgamento do recurso"**. O mesmo código significa coisas diferentes
conforme o grau — ver `02-armadilhas.md`.

### Resultado medido

| Movimentos | Fases |
|---|---|
| 214 | 6 |
| 142 (G1+G2) | 6 |
| 78 | 4 |
| 75 | 5 |
| 50 | 5 |

A saída não cresce com a entrada. Essa é a propriedade que justifica a
abordagem.

### O que não some

Movimentos que não preenchem fase nenhuma continuam disponíveis na lista
completa, a um clique. O resumo é uma camada de leitura, não uma censura.

---

## Regra 3 — Instâncias fundidas numa história só

Quando um processo existe em mais de um grau, os movimentos são **fundidos
numa linha do tempo única**, cada um etiquetado com seu grau. Os dados de
cadastro vêm da instância atualizada mais recentemente.

A leitura natural do cliente é "o que aconteceu com o meu processo", não "o
que aconteceu em cada instância".

---

## Regra 4 — A defasagem é elemento de primeira classe

A data de última atualização aparece **acima** da ficha, não no rodapé, com
destaque visual quando passa de 30 dias:

> ⚠ Atualizado no DataJud em 28/04/2026, há 120 dias. Movimentações
> posteriores a essa data ainda não foram enviadas pelo tribunal e não
> aparecem abaixo.

Um dado de quatro meses atrás precisa ser visto **antes** de ser usado.

---

## Regra 5 — Vocabulário: nunca deixar o termo técnico sozinho

Os rótulos são vocabulário jurídico apresentado a leigo. Cada um precisa de
explicação acessível (tooltip com `(i)`, focável por teclado, e que abra
também no toque — mobile não tem hover).

**"Situação atual" é o caso mais crítico**: parece um status do processo, mas
é apenas o movimento mais recente, que costuma ser ato de rotina.

| Rótulo | Explicação |
|---|---|
| Ajuizamento | Data em que o processo foi distribuído a uma vara — quando passou a existir oficialmente no tribunal. |
| Primeiro registro | O tribunal não registrou o ato de distribuição. Esta é a data do movimento mais antigo na base pública. |
| Decisão liminar | Decisão provisória tomada antes do julgamento final, normalmente por urgência. Pode ser mantida ou revista depois. |
| Saneamento | Decisão em que o juiz organiza o processo: define os pontos em disputa e quais provas serão produzidas. |
| Perícia | Nomeação de um especialista para examinar um ponto técnico do caso. |
| Audiência | Sessão em que partes, testemunhas ou o juiz se reúnem. |
| Mudança nas partes | Alguém entrou ou saiu do processo — por falecimento, sucessão ou substituição. |
| Sentença | Decisão do juiz de primeira instância que resolve o caso. Ainda cabe recurso. |
| Recurso | Uma das partes pediu que uma instância superior reexamine a decisão. |
| Decisão em 2º grau | Julgamento por um colegiado de desembargadores. |
| Julgamento do recurso | Decisão de mérito proferida na instância recursal. |
| Trânsito em julgado | Não cabem mais recursos: a decisão se tornou definitiva. |
| Arquivamento | O processo foi encerrado e baixado. Não há mais tramitação. |
| **Situação atual** | O movimento mais recente registrado pelo tribunal. **Não é uma fase do processo** — muitas vezes é um ato de rotina, como uma petição ou uma certidão. Serve para mostrar onde o processo parou. |
| Em andamento | Não há sentença nem arquivamento registrados na base pública. |
| Julgado | Há decisão de mérito, mas o processo ainda não foi arquivado. |
| Baixado | O processo foi arquivado definitivamente. |
| Última atualização | Data em que o tribunal enviou os dados ao DataJud. O envio é feito em lotes, então movimentações posteriores não aparecem aqui. |

**Onde o texto deve morar:** junto do roteiro de fases, no backend, viajando
dentro da resposta da API. Se ficar no HTML, fica preso ao front-end e o
próximo consumidor reinventa com palavras diferentes.

---

## Regra 6 — Grau em palavras

`G1` não diz nada a quem não é do meio. Traduzir: `1º grau`, `2º grau`,
`Juizado Especial`. Manter fallback para o valor cru em graus desconhecidos.
