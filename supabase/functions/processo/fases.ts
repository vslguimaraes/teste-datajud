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
  { id: 'emenda', titulo: 'Emenda à inicial', peso: 10, codigos: [15085, 12261] },
  { id: 'liminar', titulo: 'Decisão liminar', peso: 80,
    codigos: [332, 792], regex: /liminar|antecipa[çc][ãa]o de tutela|tutela (de urg[êe]ncia|provis[óo]ria)/i },
  { id: 'saneamento', titulo: 'Saneamento', peso: 40, codigos: [12387], regex: /saneamento/i },
  { id: 'pericia', titulo: 'Perícia', peso: 35, codigos: [12306], regex: /per[íi]cia|perito/i },
  { id: 'audiencia', titulo: 'Audiência', peso: 50, regex: /audi[êe]ncia/i },
  { id: 'partes', titulo: 'Mudança nas partes', peso: 30,
    codigos: [268, 12308], regex: /morte ou perda da capacidade|substitui[çc][ãa]o\/?sucess[ãa]o|sucess[ãa]o da parte/i },
  { id: 'suspensao', titulo: 'Suspensão', peso: 25,
    codigos: [12066], regex: /suspens[ãa]o|sobrestamento/i },
  { id: 'sentenca', titulo: 'Sentença', peso: 95,
    codigos: [193, 196, 198, 219, 220, 221, 237, 385, 461, 471, 11795],
    regex: /senten[çc]a|proced[êe]ncia|improceden|julgado (proceden|improceden)|extin[çc][ãa]o d|homologa[çc][ãa]o de (acordo|transa[çc][ãa]o)/i },
  { id: 'recurso', titulo: 'Recurso', peso: 60,
    regex: /apela[çc][ãa]o|agravo|embargos de declara|recurso (especial|extraordin[áa]rio|inominado)/i },
  { id: 'acordao', titulo: 'Decisão em 2º grau', peso: 70, regex: /ac[óo]rd[ãa]o|julgamento colegiado/i },
  { id: 'transito', titulo: 'Trânsito em julgado', peso: 90, regex: /tr[âa]nsito em julgado/i },
  { id: 'baixa', titulo: 'Arquivamento', peso: 85,
    codigos: [22], regex: /baixa definitiva|arquivamento definitivo/i },
];

// Teto de itens na visão do cliente. Acima disso a leitura vira lista de novo.
export const TETO_FASES = 8;

function casa(m: FichaMovimento, r: Regra): boolean {
  if (r.codigos?.includes(m.codigo)) return true;
  return r.regex ? r.regex.test(m.nome ?? '') : false;
}

/**
 * Monta o resumo do processo a partir dos movimentos já ordenados.
 *
 * Regras que valem sempre, independentemente do teto:
 *  - o ajuizamento entra (é onde a história começa);
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
      id: r.id, titulo: r.titulo, peso: r.peso,
      data: m.data, nome: m.nome, grau: m.grau, orgao: m.orgao,
      ocorrencias: casos.length,
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
