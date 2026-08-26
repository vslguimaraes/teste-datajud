// Reduz a linha do tempo ao arco do processo.
//
// POR QUE NÃO FILTRAR RUÍDO
//
// A regra anterior era subtrativa: mostrar tudo que não fosse expediente.
// Ela tem dois defeitos que o dado real expôs:
//
// 1. A saída cresce com a entrada. 78 movimentos davam 10 destaques; 214
//    davam 93. Quanto mais movimentado o processo — quando o resumo é mais
//    necessário — mais itens a regra jogava na tela.
//
// 2. Os códigos de expediente mudam por tribunal. No TJSP, Remessa é 123; no
//    TRF1 é 982. Decurso de prazo é 1051 no TRF1. Mandado aparece como 106 e
//    985 no mesmo processo. Uma lista de exclusão teria que ser mantida por
//    tribunal, e ainda assim não limitaria a saída.
//
// A regra aqui é seletiva: um roteiro fixo de fases, no máximo um evento por
// fase. A saída fica presa ao tamanho do roteiro, não ao do processo.
//
// O roteiro é deliberadamente curto. Duas fases foram removidas depois de
// ver o resultado no dado real:
//
// - Emenda à inicial: relevante para advogado, detalhe para quem lê de fora.
// - Suspensão: os códigos que existem descrevem o FIM dela ('Cumprimento de
//   Levantamento da Suspensão'), então o rótulo dizia o contrário do fato.
//
// Quando um evento não preenche fase nenhuma, ele não some — continua na
// lista completa, a um clique.

import type { FichaMovimento } from './datajud.ts';

export interface Fase {
  id: string;
  titulo: string;
  data: string;
  nome: string;       // o nome técnico do movimento, como detalhe
  grau: string;
  orgao?: string;
  ocorrencias: number; // quantas vezes a fase foi preenchida ao longo do processo
}

interface Regra {
  id: string;
  titulo: string;
  /** Peso usado só para decidir o que cortar quando passa do teto. */
  peso: number;
  codigos?: number[];
  regex?: RegExp;
  /**
   * Qual ocorrencia representa a fase.
   *
   * 'ultimo' vale para quase tudo: se houve tres decisoes liminares, a que
   * importa e a mais recente. O ajuizamento e a excecao — ali o cliente quer
   * saber quando o processo comecou, e uma Redistribuicao posterior nao
   * substitui a Distribuicao original.
   */
  usar?: 'primeiro' | 'ultimo';
}

// Ordem do roteiro = ordem natural de um processo. É a ordem de exibição
// quando as datas empatam; o peso serve para outra coisa (o corte).
const ROTEIRO: Regra[] = [
  { id: 'ajuizamento', titulo: 'Ajuizamento', peso: 100, codigos: [26, 36], usar: 'primeiro' },
  { id: 'liminar', titulo: 'Decisão liminar', peso: 80,
    codigos: [332, 792], regex: /liminar|antecipa[çc][ãa]o de tutela|tutela (de urg[êe]ncia|provis[óo]ria)/i },
  { id: 'saneamento', titulo: 'Saneamento', peso: 40, codigos: [12387], regex: /saneamento/i },
  { id: 'pericia', titulo: 'Perícia', peso: 35, codigos: [12306], regex: /per[íi]cia|perito/i },
  { id: 'audiencia', titulo: 'Audiência', peso: 50, regex: /audi[êe]ncia/i },
  { id: 'partes', titulo: 'Mudança nas partes', peso: 30,
    codigos: [268, 12308], regex: /morte ou perda da capacidade|substitui[çc][ãa]o\/?sucess[ãa]o|sucess[ãa]o da parte/i },
  { id: 'sentenca', titulo: 'Sentença', peso: 95,
    codigos: [193, 196, 198, 219, 220, 221, 237, 385, 461, 471, 11795],
    regex: /senten[çc]a|proced[êe]ncia|improceden|julgado (proceden|improceden)|extin[çc][ãa]o d|homologa[çc][ãa]o de (acordo|transa[çc][ãa]o)/i },
  // 'Apelação' foi verificado contra o índice do TJSP: ZERO processos usam
  // esse nome. O que existe é 'Recurso ...', 'Provimento' e 'Não-Provimento'.
  { id: 'recurso', titulo: 'Recurso', peso: 60,
    regex: /recurso|agravo|embargos de declara|apela[çc][ãa]o/i },
  { id: 'acordao', titulo: 'Decisão em 2º grau', peso: 70,
    regex: /ac[óo]rd[ãa]o|julgamento colegiado|n[ãa]o-?provimento|provimento/i },
  { id: 'transito', titulo: 'Trânsito em julgado', peso: 90, regex: /tr[âa]nsito em julgado/i },
  { id: 'baixa', titulo: 'Arquivamento', peso: 85,
    codigos: [22], regex: /baixa definitiva|arquivamento definitivo/i },
];

// Teto de itens na visão do cliente. Acima disso a leitura vira lista de novo.
export const TETO_FASES = 8;

// Instâncias recursais. Importa porque o mesmo código de movimento significa
// coisas diferentes conforme o grau.
const GRAU_RECURSAL = new Set(['G2', 'G3', 'TR', 'TU', 'SUP']);

/**
 * Ajusta o rótulo da fase ao grau em que ela aconteceu.
 *
 * O código 193 chama-se 'Julgamento' e vale como decisão de mérito em
 * qualquer instância — mas chamá-lo de 'Sentença' num documento de 2º grau
 * inverte a história: no processo 0091910-41.0000.8.26.0090 apareciam um
 * acórdão em 2012 e uma 'Sentença' em 2026, como se o feito tivesse
 * retrocedido. Em instância recursal, o que houve foi julgamento do recurso.
 */
function tituloNoGrau(id: string, titulo: string, grau: string): string {
  if (id === 'sentenca' && GRAU_RECURSAL.has(grau)) return 'Julgamento do recurso';
  return titulo;
}

function casa(m: FichaMovimento, r: Regra): boolean {
  if (r.codigos?.includes(m.codigo)) return true;
  return r.regex ? r.regex.test(m.nome ?? '') : false;
}

/**
 * Monta o resumo do processo a partir dos movimentos já ordenados.
 *
 * Regras que valem sempre, independentemente do teto:
 *  - a linha do tempo sempre começa em algum lugar: se nenhum movimento for
 *    Distribuição ou Redistribuição, o primeiro registro assume esse papel.
 *    O processo 0047512-82.2007.8.26.0050 mostrou que a garantia anterior era
 *    falsa — ela dependia de um movimento casar, e ali nenhum casava;
 *  - o último movimento entra como "situação atual", mesmo sendo expediente,
 *    porque é a pergunta que o cliente realmente faz: onde está agora?
 */
export function resumirEmFases(movimentos: FichaMovimento[]): Fase[] {
  if (movimentos.length === 0) return [];

  const encontradas: (Fase & { peso: number })[] = [];

  for (const r of ROTEIRO) {
    const casos = movimentos.filter((m) => casa(m, r));
    if (casos.length === 0) continue;
    const m = r.usar === 'primeiro' ? casos[0] : casos[casos.length - 1];
    encontradas.push({
      id: r.id, titulo: tituloNoGrau(r.id, r.titulo, m.grau), peso: r.peso,
      data: m.data, nome: m.nome, grau: m.grau, orgao: m.orgao,
      ocorrencias: casos.length,
    });
  }

  // Sem Distribuição nem Redistribuição, o primeiro movimento vira o começo.
  // Um resumo que abre no meio da história deixa o leitor sem referência.
  if (!encontradas.some((f) => f.id === 'ajuizamento')) {
    const primeiro = movimentos[0];
    encontradas.push({
      id: 'ajuizamento', titulo: 'Primeiro registro', peso: 100,
      data: primeiro.data, nome: primeiro.nome, grau: primeiro.grau,
      orgao: primeiro.orgao, ocorrencias: 1,
    });
  }

  const ultimo = movimentos[movimentos.length - 1];
  const jaTemUltimo = encontradas.some((f) => f.data === ultimo.data && f.nome === ultimo.nome);

  // Corta pelo peso, preservando o ajuizamento. A vaga da "situação atual"
  // é reservada antes do corte para o último movimento não roubar espaço.
  const vagas = TETO_FASES - (jaTemUltimo ? 0 : 1);
  const mantidas = encontradas
    .sort((a, b) => (b.id === 'ajuizamento' ? 1 : 0) - (a.id === 'ajuizamento' ? 1 : 0) || b.peso - a.peso)
    .slice(0, vagas);

  if (!jaTemUltimo) {
    mantidas.push({
      id: 'atual', titulo: 'Situação atual', peso: -1,
      data: ultimo.data, nome: ultimo.nome, grau: ultimo.grau, orgao: ultimo.orgao,
      ocorrencias: 1,
    });
  }

  // Exibição é cronológica; o peso serviu apenas para escolher o que cortar.
  return mantidas
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(({ peso: _peso, ...f }) => f);
}
