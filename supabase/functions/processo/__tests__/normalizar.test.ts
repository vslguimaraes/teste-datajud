// Subconjunto fiel do retorno real do TJSP de 25/08/2026: preserva a DESORDEM
// do array original (posição 11 = 2026-03-26, posição 12 volta para 2024-06-04),
// que é justamente a armadilha que o normalizador precisa corrigir.
import { readFileSync } from 'node:fs';
import { parseNumero } from '../cnj.ts';
import { normalizar } from '../datajud.ts';

const fonte = JSON.parse(readFileSync(new URL('./fixture-tjsp.json', import.meta.url), 'utf8'));
const p = parseNumero('1083208-94.2023.8.26.0053');
if (!p.ok) throw new Error('fixture com numero invalido');

// Congelado para o teste nao mudar de resultado conforme o tempo passa.
const AGORA = new Date('2026-08-25T00:00:00Z');
const f = normalizar([fonte], p.numero, AGORA);

let falhas = 0;
const check = (rot: string, cond: boolean, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FALHA'}  ${rot}${extra ? '  -> ' + extra : ''}`);
  if (!cond) falhas++;
};

check('ordena movimentos cronologicamente',
  f.movimentos.every((m, i) => i === 0 || f.movimentos[i - 1].data <= m.data));

check('ultimo movimento e a conclusao de 2026-03-26',
  f.ultimoMovimento?.data.startsWith('2026-03-26') === true,
  f.ultimoMovimento?.data ?? 'nenhum');

// A prova de que a ordenacao importa: o ultimo item do array CRU e outro.
check('array cru terminava em movimento diferente',
  fonte.movimentos.at(-1).dataHora.startsWith('2024-06-04'),
  fonte.movimentos.at(-1).nome);

check('primeiro movimento e a distribuicao de 2023-12-05',
  f.movimentos[0].data.startsWith('2023-12-05'), f.movimentos[0].nome);

check('situacao = em_andamento (sem sentenca nem baixa)',
  f.situacao === 'em_andamento', f.situacaoDescricao);

check('nao marca Conclusao como julgamento',
  !f.movimentos.find((m) => m.nome === 'Conclusão')?.marco);

check('marca Antecipacao de tutela? nao e julgamento de merito',
  f.movimentos.find((m) => m.nome === 'Antecipação de tutela')?.marco === false);

check('dataAjuizamento converte formato compacto',
  f.dataAjuizamento === '2023-12-05T13:53:23.000Z', f.dataAjuizamento ?? 'null');

check('detecta defasagem', f.dadoDefasado === true, `${f.atualizadoHaDias} dias`);
check('defasagem = 118 dias', f.atualizadoHaDias === 118, String(f.atualizadoHaDias));
check('classe', f.classe === 'Procedimento Comum Cível', f.classe ?? '');
check('nao sigiloso', f.sigiloso === false);
check('3 assuntos', f.assuntos.length === 3, f.assuntos.join('; '));
check('grau G1', f.graus.join(',') === 'G1');
check('total de movimentos', f.totalMovimentos === 17, String(f.totalMovimentos));

// Um processo baixado deve ser detectado (padrao visto na amostra do TRF3).
const baixado = normalizar([{
  ...fonte,
  movimentos: [...fonte.movimentos,
    { codigo: 22, nome: 'Baixa Definitiva', dataHora: '2026-05-02T10:00:00.000Z' }],
}], p.numero, AGORA);
check('detecta baixa definitiva', baixado.situacao === 'baixado', baixado.situacaoDescricao);

console.log(`\nUltimos 3 movimentos apos ordenacao:`);
for (const m of f.movimentos.slice(-3)) {
  console.log(`  ${m.data.slice(0, 10)}  ${m.nome}${m.complementos.length ? ' (' + m.complementos.join(', ') + ')' : ''}`);
}
console.log(`\nSituacao: ${f.situacaoDescricao}`);
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
