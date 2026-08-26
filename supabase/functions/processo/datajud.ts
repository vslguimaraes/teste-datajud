// Normalização do retorno do DataJud para a ficha que o front-end exibe.
//
// Três comportamentos reais da API, observados nos testes de 25/08/2026,
// moldam este módulo:
//
// 1. `movimentos` NÃO vem em ordem cronológica. No TJSP real, a posição 1 era
//    de 2023-12-05, a 48 de 2026-03-26 e a 49 voltava para 2024-06-04. Ler o
//    último elemento do array dá o andamento errado. Ordenamos sempre.
// 2. Não existe campo de status. Ele é derivado dos movimentos.
// 3. Resultado vazio é AMBÍGUO: sigilo, número inexistente e lacuna de
//    replicação retornam todos HTTP 200 com hits 0. Nunca dizemos "não existe".

import type { NumeroCNJ } from './cnj.ts';
import { type Fase, resumirEmFases } from './fases.ts';

const BASE = 'https://api-publica.datajud.cnj.jus.br';

export interface Movimento {
  codigo: number;
  nome: string;
  dataHora: string;
  orgaoJulgador?: { codigo?: string; nome?: string };
  complementosTabelados?: { codigo: number; nome: string; descricao: string; valor: number }[];
}

interface Fonte {
  id: string;
  numeroProcesso: string;
  tribunal: string;
  grau: string;
  nivelSigilo: number;
  dataAjuizamento: string;
  dataHoraUltimaAtualizacao: string;
  classe?: { codigo: number; nome: string };
  sistema?: { codigo: number; nome: string };
  formato?: { codigo: number; nome: string };
  orgaoJulgador?: { codigo?: number; nome?: string };
  assuntos?: { codigo: number; nome: string }[];
  movimentos?: Movimento[];
}

// Códigos da Tabela Processual Unificada do CNJ.
// ATENÇÃO: apenas o 22 foi observado em dado real (amostra do TRF3). Os demais
// são a melhor leitura da TPU e precisam de validação contra a tabela oficial
// antes de sair do beta — por isso o casamento por NOME abaixo, que serve de
// rede de segurança quando o código não está mapeado.
const COD_BAIXA = new Set([22]);
const COD_JULGAMENTO = new Set([193, 196, 198, 219, 220, 221, 237, 385, 461, 471]);

const RE_JULGAMENTO = /senten|julgado|julgamento|extin[çc]|homologa[çc]|improceden|proceden/i;
const RE_BAIXA = /baixa definitiva|arquivamento definitivo/i;

// Movimentos de EXPEDIENTE: alto volume, baixo significado. No processo real
// do TJSP eles são 68 dos 78 movimentos — listá-los com o mesmo peso dos
// demais reproduz o JSON cru, que é o problema que este beta existe para
// resolver.
//
// A lista é dos códigos a IGNORAR, não dos relevantes: os de expediente são
// poucos, padronizados e comuns a todos os tribunais, enquanto os
// significativos são uma cauda longa que varia por rito e por vara. Marcar
// por exclusão erra para o lado de mostrar demais, que é o lado seguro.
const COD_EXPEDIENTE = new Set([
  60,     // Expedição de documento
  92,     // Publicação
  123,    // Remessa
  51,     // Conclusão (ir ao magistrado não é decidir)
  85,     // Petição
  581,    // Documento
  11383,  // Ato ordinatório
  246,    // Juntada
  67,     // Decurso de prazo
]);

export type Situacao = 'baixado' | 'julgado' | 'em_andamento';

export interface FichaMovimento {
  data: string;
  nome: string;
  codigo: number;
  grau: string;
  orgao?: string;
  complementos: string[];
  marco: boolean;
}

export interface Ficha {
  numero: string;
  numeroFormatado: string;
  tribunal: string;
  graus: string[];
  classe: string | null;
  assuntos: string[];
  orgaoJulgadorAtual: string | null;
  sistema: string | null;
  dataAjuizamento: string | null;
  sigiloso: boolean;
  situacao: Situacao;
  situacaoDescricao: string;
  ultimoMovimento: FichaMovimento | null;
  atualizadoEm: string;
  atualizadoHaDias: number;
  dadoDefasado: boolean;
  totalMovimentos: number;
  /** O arco do processo em 4-8 itens. Ver fases.ts. */
  fases: Fase[];
  movimentos: FichaMovimento[];
}

/** "20231205135323" -> "2023-12-05T13:53:23Z". O DataJud usa os dois formatos. */
function normalizarData(v: string | undefined): string | null {
  if (!v) return null;
  // Passa pelo Date para sair no mesmo formato do ramo ISO abaixo: sem isso,
  // dataAjuizamento vinha "...:23Z" e as demais "...:23.000Z", e o front-end
  // receberia dois formatos de data da mesma resposta.
  if (/^\d{14}$/.test(v)) {
    const [, a, m, d, h, mi, s] = v.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)!;
    const t = Date.parse(`${a}-${m}-${d}T${h}:${mi}:${s}Z`);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * Um movimento merece destaque na leitura?
 *
 * Julgamento e baixa sempre merecem. Fora isso, vale tudo que não for
 * expediente — assim decisões, tutelas, saneamento, redistribuição e
 * audiências aparecem sem precisarem estar num catálogo que eu teria de
 * manter à mão.
 */
function ehMarco(m: Movimento): boolean {
  if (COD_BAIXA.has(m.codigo) || COD_JULGAMENTO.has(m.codigo)) return true;
  if (RE_BAIXA.test(m.nome ?? '') || RE_JULGAMENTO.test(m.nome ?? '')) return true;
  return !COD_EXPEDIENTE.has(m.codigo);
}

/**
 * Consolida os documentos de um processo numa ficha única.
 *
 * Um mesmo processo pode existir como vários documentos, um por grau
 * (TJSP_G1_..., TJSP_G2_...). Fundimos os movimentos numa linha do tempo só,
 * etiquetando cada um com o grau de origem — a leitura natural é "o que
 * aconteceu com o meu processo", não "o que aconteceu em cada instância".
 */
export function normalizar(fontes: Fonte[], numero: NumeroCNJ, agora = new Date()): Ficha {
  // A instância mais recentemente atualizada manda nos dados de cadastro.
  const principal = [...fontes].sort((a, b) =>
    (normalizarData(b.dataHoraUltimaAtualizacao) ?? '').localeCompare(
      normalizarData(a.dataHoraUltimaAtualizacao) ?? ''))[0];

  const movimentos: FichaMovimento[] = fontes
    .flatMap((f) => (f.movimentos ?? []).map((m) => ({
      data: normalizarData(m.dataHora) ?? '',
      nome: m.nome,
      codigo: m.codigo,
      grau: f.grau,
      orgao: m.orgaoJulgador?.nome,
      complementos: (m.complementosTabelados ?? []).map((c) => c.nome),
      marco: ehMarco(m),
    })))
    .filter((m) => m.data)
    .sort((a, b) => a.data.localeCompare(b.data)); // <- a correção crítica

  const ultimaBaixa = [...movimentos].reverse()
    .find((m) => COD_BAIXA.has(m.codigo) || RE_BAIXA.test(m.nome));
  const ultimoJulgamento = [...movimentos].reverse()
    .find((m) => COD_JULGAMENTO.has(m.codigo) || RE_JULGAMENTO.test(m.nome));

  let situacao: Situacao;
  let situacaoDescricao: string;
  if (ultimaBaixa) {
    situacao = 'baixado';
    situacaoDescricao = `Baixado definitivamente em ${ultimaBaixa.data.slice(0, 10)}`;
  } else if (ultimoJulgamento) {
    situacao = 'julgado';
    situacaoDescricao = `${ultimoJulgamento.nome} em ${ultimoJulgamento.data.slice(0, 10)}, sem baixa registrada`;
  } else {
    situacao = 'em_andamento';
    situacaoDescricao = 'Em andamento, sem julgamento nem baixa registrados';
  }

  const atualizado = normalizarData(principal.dataHoraUltimaAtualizacao) ?? '';
  const dias = atualizado
    ? Math.floor((agora.getTime() - Date.parse(atualizado)) / 86_400_000)
    : -1;

  return {
    numero: numero.digitos,
    numeroFormatado: numero.formatado,
    tribunal: principal.tribunal,
    graus: [...new Set(fontes.map((f) => f.grau))].sort(),
    classe: principal.classe?.nome ?? null,
    assuntos: (principal.assuntos ?? []).map((a) => a.nome),
    orgaoJulgadorAtual: principal.orgaoJulgador?.nome ?? null,
    sistema: principal.sistema?.nome ?? null,
    dataAjuizamento: normalizarData(principal.dataAjuizamento),
    sigiloso: (principal.nivelSigilo ?? 0) > 0,
    situacao,
    situacaoDescricao,
    ultimoMovimento: movimentos.at(-1) ?? null,
    atualizadoEm: atualizado,
    atualizadoHaDias: dias,
    // O DataJud replica em lote. Acima de 30 dias, a tela precisa avisar que
    // o dado pode não refletir a situação atual do processo.
    dadoDefasado: dias > 30,
    totalMovimentos: movimentos.length,
    fases: resumirEmFases(movimentos),
    movimentos,
  };
}

export interface RespostaBusca {
  estado: 'encontrado' | 'nao_indexado';
  ficha?: Ficha;
  alias: string;
}

export async function buscar(
  alias: string, numero: NumeroCNJ, apiKey: string, fetchImpl = fetch,
): Promise<RespostaBusca> {
  const r = await fetchImpl(`${BASE}/api_publica_${alias}/_search`, {
    method: 'POST',
    headers: { Authorization: `APIKey ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { match: { numeroProcesso: numero.digitos } }, size: 10 }),
  });

  if (!r.ok) {
    throw Object.assign(new Error(`DataJud respondeu HTTP ${r.status}`), { status: r.status });
  }

  const json = await r.json();
  const fontes: Fonte[] = (json?.hits?.hits ?? []).map((h: { _source: Fonte }) => h._source);

  // Vazio não é "não existe" — é "não está no índice público", e as causas
  // possíveis são indistinguíveis daqui.
  if (fontes.length === 0) return { estado: 'nao_indexado', alias };

  return { estado: 'encontrado', alias, ficha: normalizar(fontes, numero) };
}
