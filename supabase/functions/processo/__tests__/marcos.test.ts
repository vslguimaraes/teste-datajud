// Classificacao de relevancia dos movimentos.
//
// Os pares (codigo, nome) abaixo sao TODOS os distintos que apareceram no
// retorno real do processo 1083208-94.2023.8.26.0053 consultado pela funcao
// publicada em 26/08/2026 — 78 movimentos, 13 codigos distintos.
import { parseNumero } from '../cnj.ts';
import { normalizar } from '../datajud.ts';

const p = parseNumero('1083208-94.2023.8.26.0053');
if (!p.ok) throw new Error('numero invalido');

// [codigo, nome, quantas vezes apareceu, deve ser marco?]
const REAIS: [number, string, number, boolean][] = [
  [26,    'Distribuição',                          1, true ],
  [36,    'Redistribuição',                        1, true ],
  [332,   'Antecipação de tutela',                 1, true ],
  [12387, 'Decisão de Saneamento e Organização',   1, true ],
  [12164, 'Outras Decisões',                       5, true ],
  [15085, 'Emenda à Inicial',                      1, true ],
  [51,    'Conclusão',                            12, false],
  [60,    'Expedição de documento',               23, false],
  [85,    'Petição',                              10, false],
  [92,    'Publicação',                            7, false],
  [123,   'Remessa',                               8, false],
  [581,   'Documento',                             4, false],
  [11383, 'Ato ordinatório',                       4, false],
];

let n = 0;
const movimentos = REAIS.flatMap(([codigo, nome, vezes]) =>
  Array.from({ length: vezes }, () => ({
    codigo, nome,
    dataHora: new Date(Date.UTC(2024, 0, 1 + (n++))).toISOString(),
  })));

const f = normalizar([{
  id: 'TJSP_G1_x', numeroProcesso: p.numero.digitos, tribunal: 'TJSP', grau: 'G1',
  nivelSigilo: 0, dataAjuizamento: '20231205135323',
  dataHoraUltimaAtualizacao: '2026-04-28T04:55:55.885Z', movimentos,
}], p.numero, new Date('2026-08-26T00:00:00Z'));

let falhas = 0;
const check = (r: string, c: boolean, x = '') => {
  console.log(`${c ? 'PASS' : 'FALHA'}  ${r}${x ? '  -> ' + x : ''}`); if (!c) falhas++;
};

check('total confere com o processo real', f.totalMovimentos === 78, String(f.totalMovimentos));

for (const [codigo, nome, , esperado] of REAIS) {
  const m = f.movimentos.find((x) => x.codigo === codigo);
  check(`${esperado ? 'destaca ' : 'ignora  '} ${nome} (${codigo})`, m?.marco === esperado);
}

const marcos = f.movimentos.filter((m) => m.marco);
check('10 marcos entre 78 movimentos', marcos.length === 10, String(marcos.length));

// A regra so vale se filtrar de verdade: destacar quase tudo nao ajuda ninguem.
const proporcao = marcos.length / f.totalMovimentos;
check('marcos sao minoria clara (<25%)', proporcao < 0.25,
  `${(proporcao * 100).toFixed(0)}%`);

// Codigo novo, nunca visto: melhor mostrar do que esconder.
const desconhecido = normalizar([{
  id: 'x', numeroProcesso: p.numero.digitos, tribunal: 'TJSP', grau: 'G1',
  nivelSigilo: 0, dataAjuizamento: '20231205135323',
  dataHoraUltimaAtualizacao: '2026-04-28T04:55:55.885Z',
  movimentos: [{ codigo: 999999, nome: 'Audiência de Instrução', dataHora: '2025-01-01T10:00:00Z' }],
}], p.numero);
check('codigo desconhecido erra para o lado de mostrar',
  desconhecido.movimentos[0].marco === true);

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
