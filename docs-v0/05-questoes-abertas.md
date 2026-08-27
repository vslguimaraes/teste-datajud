# Questões abertas

Riscos e lacunas conhecidos antes de escalar. Não são especulação: cada item
tem uma razão concreta de estar aqui.

---

## 1. Só ritos cíveis foram validados

Toda a validação do roteiro de fases foi feita com processos cíveis, em
justiça estadual e federal.

**Não sabemos** como o resumo se comporta em:

- Justiça do Trabalho — rito próprio, audiência inicial obrigatória
- Criminal — denúncia, recebimento, instrução, sentença têm outro vocabulário
- Execução fiscal — penhora, embargos, arrematação; arco completamente diferente
- Juizados Especiais — rito simplificado, embora `grau: JE` já tenha aparecido

**Como resolver:** para cada rito, consultar o índice do tribunal
correspondente e levantar a distribuição real de nomes e códigos de movimento
antes de estender o roteiro. A técnica está em `01-api-datajud.md`. A regra
atual erra para o lado seguro — se nada casa, mostra ao menos o início e a
situação atual — mas o resumo fica pobre.

---

## 2. A cota compartilhada é um risco de disponibilidade não quantificado

Não sabemos o teto, não sabemos o consumo agregado, e não temos como negociar
prioridade. Um pico de uso de terceiros pode derrubar o produto.

**Perguntas a responder antes de escalar:**

- O CNJ concede chave individual mediante cadastro? (a documentação sugere que
  a chave pública é para testes)
- Qual o comportamento real sob `429` — janela de tempo, reset?
- Vale contratar um agregador comercial como fonte secundária?

---

## 3. Cobertura do índice é desconhecida

Sabemos que processos recentes frequentemente não estão lá, e que sigilosos
nunca estão. **Não sabemos a taxa**: de cada 100 números que um usuário digitar,
quantos retornam ficha?

Esse número define a percepção de qualidade do produto e deveria ser medido
desde o primeiro dia — é a métrica mais importante do beta.

---

## 4. Não há dado de partes, valor ou conteúdo

O DataJud traz metadados e movimentos. Não traz nomes de partes, advogados,
valor da causa nem o teor das decisões.

Se o produto precisar disso, é outra fonte — e outra conversa sobre custo e
sobre LGPD.

---

## 5. Privacidade e uso responsável

Os dados são públicos, mas isso não esgota a questão:

- Uma lista de processos consultados por um usuário é informação sensível sobre
  esse usuário, mesmo que cada processo seja público individualmente.
- Guardar histórico de consultas exige base legal e política de retenção.
- Agregar processos por parte cria um perfil — território de dados pessoais,
  ainda que a origem seja pública.

Vale decidir explicitamente o que é registrado, por quanto tempo, e o que
aparece na política de privacidade.

---

## 6. Confiabilidade dos códigos da TPU

Boa parte das regras usa códigos da Tabela Processual Unificada do CNJ. Apenas
alguns foram confirmados em dado real; os demais vêm de leitura da tabela.

Por isso as regras casam **por código e por nome** — o nome serve de rede
quando o código não está mapeado. Vale, em algum momento, baixar a TPU oficial
e conferir a lista inteira.

---

## 7. Monitoramento

Se o DataJud mudar o formato de um campo, a aplicação continua respondendo
`HTTP 200` com dado degradado. Ninguém percebe até um usuário reclamar.

Um teste de fumaça diário contra a API real, verificando invariantes
(movimentos em ordem, campos obrigatórios presentes, resumo não vazio), é
barato e pega esse tipo de quebra.

---

## 8. Evolução natural: carteira monitorada

O produto validado é consulta avulsa. O passo seguinte óbvio é acompanhar uma
lista de processos e destacar o que mudou desde a última visita.

A infraestrutura de cache já é metade do necessário: falta agendamento
periódico e diff entre versões da ficha. É onde a proposta de valor sai de
"consultar" para "acompanhar" — mas exige resolver antes a questão 2, porque
polling multiplica o consumo da cota.
