# Arquitetura

Decisões estruturais e o raciocínio por trás delas. Referência de implementação
validada; o v0 pode escolher outra stack, mas as forças em jogo são as mesmas.

## A restrição que define tudo: o navegador não pode falar com o DataJud

Duas razões independentes:

1. A API não é feita para consumo em browser.
2. A chave iria no código-fonte da página.

Isso força uma **camada intermediária** entre o front-end e o CNJ,
independentemente de como o produto for entregue. Não é escolha de arquitetura,
é pré-requisito.

## O cache é proteção, não otimização

A chave do CNJ é compartilhada por todos os consumidores do país. Não há cota
própria, o teto não é documentado, e um pico de uso alheio pode derrubar a
aplicação.

Ao mesmo tempo, o dado do outro lado é replicado em lote e chega a ficar meses
atrasado. **Guardar a resposta por horas não custa frescor nenhum.**

Conclusão: cache com TTL longo (6h é um bom ponto de partida) não é performance
— é o que mantém o produto disponível quando a cota aperta.

Duas consequências de projeto:

- **Falha de cache nunca derruba a consulta.** No pior caso paga uma chamada a
  mais ao CNJ, o que é melhor que devolver erro.
- **Precisa existir um jeito de furar o cache** (`?fresh=1`). Sem isso, testar
  qualquer correção exige mexer no banco à mão, e uma ficha gravada com bug
  fica servindo resposta errada até o TTL vencer.

## Versionar o formato do que está em cache

Armadilha que morde duas vezes: quando o formato da resposta muda, as fichas já
gravadas continuam no formato antigo e são servidas como se fossem válidas. O
sintoma aparece longe da causa — campos `undefined` na tela, listas vazias.

**Ao ler do cache, verificar se o registro tem o formato atual. Se não tiver,
tratar como ausência de cache e reconsultar.** Cada entrada velha se cura
sozinha no primeiro acesso, sem migração.

## Montar a resposta em um lugar só

Sintoma real: a resposta era construída em dois pontos do código — no acerto de
cache e na consulta nova — e o caminho do cache devolvia menos campos. A
primeira consulta funcionava; da segunda em diante chegava mutilada.

**Uma única função constrói o corpo da resposta**, usada por todos os caminhos.
E um teste compara as chaves produzidas por cada caminho, falhando se
divergirem.

## Validar antes de gastar cota

O dígito verificador é conferido **duas vezes**: no navegador, para dar erro
imediato sem chamada de rede, e no backend, porque validação de cliente não é
validação.

Erro de digitação nunca deve consumir requisição da cota compartilhada.

## Estados de resposta explícitos

A API do produto devolve um estado nomeado, não apenas um código HTTP:

| Estado | HTTP | Significado |
|---|---|---|
| `encontrado` | 200 | Ficha montada |
| `nao_indexado` | 200 | Não está no índice. **Nunca** significa "não existe" |
| `numero_invalido` | 400 | Falhou tamanho ou dígito verificador |
| `tribunal_sem_indice` | 422 | STF, CNJ, ou par J.TR inexistente |
| `limite_excedido` | 429 | Cota compartilhada do CNJ estourada |
| `erro_upstream` | 502 | DataJud não respondeu como esperado |
| `erro_configuracao` | 500 | Serviço mal configurado |

`nao_indexado` acompanha as três causas possíveis no corpo da resposta, para
que qualquer consumidor da API — não só a tela — tenha como explicar ao usuário.

## Latência: hospedar perto do CNJ

A API do CNJ está no Brasil. Rodar a camada intermediária em região brasileira
evita que cada consulta que sai do cache atravesse o hemisfério duas vezes.

## Referência de implementação

A implementação validada usa: edge function serverless em região brasileira +
tabela Postgres como cache + página estática consumindo a função. Nada disso é
obrigatório — o que é obrigatório são as forças acima.

Uma nota sobre chaves: se o front-end for estático e público, a chave que ele
carrega precisa ser de publicação (restrita a leitura, rotacionável). A chave
de serviço nunca pode aparecer no cliente.

## Testes sem rede

Toda a lógica de normalização, roteamento e resumo é testável com fixtures
capturadas de respostas reais — sem tocar na API. Isso permite rodar a suíte a
cada commit sem consumir a cota compartilhada.

Separadamente, vale um teste de fumaça contra o serviço publicado, cobrindo
especificamente as regressões que já aconteceram: ordem cronológica dos
movimentos e integridade do corpo servido do cache.
