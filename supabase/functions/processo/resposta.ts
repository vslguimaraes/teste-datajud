// Forma do corpo devolvido ao front-end.
//
// Este módulo existe por causa de um bug real: a resposta era montada em dois
// lugares — no acerto de cache e na consulta nova — e a do cache devolvia
// apenas estado, alias e ficha. Um 'nao_indexado' servido do cache chegava na
// tela sem numeroFormatado, sem tribunal e sem as causas possíveis, exibindo
// "O número undefined é válido e aponta para o undefined".
//
// Com uma fonte única, os dois caminhos não têm como divergir — e o teste
// compara as chaves dos dois para garantir que continue assim.

export function corpoResposta(
  estado: string,
  ficha: unknown,
  alias: string,
  numero: { formatado: string },
) {
  if (estado === 'encontrado') return { estado, alias, ficha };

  // 'nao_indexado' nunca vira "o processo não existe": pela API pública é
  // impossível separar sigilo, número inexistente e lacuna de replicação.
  return {
    estado: 'nao_indexado',
    alias,
    numeroFormatado: numero.formatado,
    tribunalDeduzido: alias.toUpperCase(),
    mensagem: 'Este processo não está no índice público do DataJud.',
    causasPossiveis: [
      'O processo tramita em segredo de justiça — a API pública só expõe processos sem sigilo.',
      'O tribunal ainda não replicou este processo. O envio é feito em lotes, e processos recentes costumam levar semanas ou meses para aparecer.',
      'O número está correto na forma, mas não corresponde a um processo existente nesse tribunal.',
    ],
  };
}
