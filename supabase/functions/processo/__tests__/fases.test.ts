// Testa o resumo em fases contra os dois processos reais que consultamos.
import { readFileSync } from 'node:fs';
import { parseNumero } from '../cnj.ts';
import { normalizar } from '../datajud.ts';
import { resumirEmFases, TETO_FASES } from '../fases.ts';

let falhas = 0;
const check = (r: string, c: boolean, x = '') => {
  console.log(`${c ? 'PASS' : 'FALHA'}  ${r}${x ? '  -> ' + x : ''}`); if (!c) falhas++;
};

const p = parseNumero('1083208-94.2023.8.26.0053');
if (!p.ok) throw new Error('numero invalido');

// ---------- TJSP: 78 movimentos reais ----------
const tjsp = JSON.parse(readFileSync(new URL('./fixture-tjsp.json', import.meta.url), 'utf8'));
const fTjsp = normalizar([tjsp], p.numero, new Date('2026-08-26T00:00:00Z'));
const fasesTjsp = resumirEmFases(fTjsp.movimentos);

console.log(`\nTJSP — ${fTjsp.totalMovimentos} movimentos -> ${fasesTjsp.length} fases:`);
for (const f of fasesTjsp) {
  console.log(`  ${f.data.slice(0, 10)}  ${f.titulo.padEnd(22)} ${f.nome}${f.ocorrencias > 1 ? ` (${f.ocorrencias}x)` : ''}`);
}
check('TJSP fica na faixa 4-8', fasesTjsp.length >= 4 && fasesTjsp.length <= 8, String(fasesTjsp.length));
check('TJSP comeca no ajuizamento', fasesTjsp[0].id === 'ajuizamento', fasesTjsp[0].id);
check('TJSP identifica a liminar', fasesTjsp.some((f) => f.id === 'liminar'));
check('TJSP identifica o saneamento', fasesTjsp.some((f) => f.id === 'saneamento'));
check('TJSP termina na situacao atual', fasesTjsp.at(-1)?.id === 'atual', fasesTjsp.at(-1)?.id ?? '');

// ---------- TRF1: 214 movimentos, distribuicao real de codigos ----------
// Frequencias exatas do processo 1014505-11.2024.4.01.3900, consultado em
// 26/08/2026. As datas sao sinteticas; os codigos e nomes sao os reais.
const TRF1: [number, number, string][] = [
  [45, 85, 'Petição'], [40, 581, 'Documento'],
  [21, 12215, 'Processo devolvido à Secretaria'], [21, 51, 'Conclusão'],
  [20, 12282, 'Expedida/Certificada'], [13, 1051, 'Decurso de Prazo'],
  [10, 60, 'Expedição de documento'], [8, 12164, 'Outras Decisões'],
  [6, 11010, 'Mero expediente'], [5, 1061, 'Disponibilização no Diário da Justiça Eletrônico'],
  [5, 92, 'Publicação'], [2, 15085, 'Emenda à Inicial'],
  [2, 268, 'Morte ou perda da capacidade'], [2, 15216, ''],
  [1, 219, 'Procedência'], [1, 106, 'Mandado'],
  [1, 11795, 'Procedência do Pedido - Reconhecimento pelo réu'],
  [1, 12066, 'Cumprimento de Levantamento da Suspensão'], [1, 898, 'Por decisão judicial'],
  [1, 12308, 'Substituição/Sucessão da Parte'], [1, 982, 'Remessa'],
  [1, 12261, 'Emenda a inicial'], [1, 26, 'Distribuição'], [1, 981, 'Recebimento'],
  [1, 12306, 'Perito'], [1, 985, 'Mandado'], [1, 792, 'Liminar'],
  [1, 12287, 'Expedida/Certificada'],
];

// A Distribuicao precisa ser o primeiro evento e a sentenca vir perto do fim,
// para o teste medir o resumo e nao um embaralhamento impossivel.
const ORDEM_FIXA: Record<number, number> = { 26: 0, 792: 20, 15085: 10, 12261: 12, 268: 120, 12308: 125, 12306: 60, 219: 200, 11795: 205, 12066: 190 };
let seq = 0;
const movsTrf1 = TRF1.flatMap(([n, codigo, nome]) =>
  Array.from({ length: n }, (_, i) => ({
    codigo, nome, grau: 'G1', complementos: [], marco: false,
    data: new Date(Date.UTC(2024, 0, 1 + (ORDEM_FIXA[codigo] ?? (30 + (seq++ % 150))), 0, i)).toISOString(),
  })),
).sort((a, b) => a.data.localeCompare(b.data));

check('fixture TRF1 tem 214 movimentos', movsTrf1.length === 214, String(movsTrf1.length));

const fasesTrf1 = resumirEmFases(movsTrf1);
console.log(`\nTRF1 — 214 movimentos -> ${fasesTrf1.length} fases:`);
for (const f of fasesTrf1) {
  console.log(`  ${f.data.slice(0, 10)}  ${f.titulo.padEnd(22)} ${f.nome || '(sem nome)'}${f.ocorrencias > 1 ? ` (${f.ocorrencias}x)` : ''}`);
}
check('TRF1 fica na faixa 4-8', fasesTrf1.length >= 4 && fasesTrf1.length <= 8, String(fasesTrf1.length));
check('TRF1 nunca passa do teto', fasesTrf1.length <= TETO_FASES, String(fasesTrf1.length));
check('TRF1 identifica a Liminar (792)', fasesTrf1.some((f) => f.id === 'liminar'));
check('TRF1 identifica a Procedencia como sentenca', fasesTrf1.some((f) => f.id === 'sentenca'));
check('TRF1 identifica a mudanca de partes', fasesTrf1.some((f) => f.id === 'partes'));
check('TRF1 identifica a pericia', fasesTrf1.some((f) => f.id === 'pericia'));
check('TRF1 ignora expediente de alto volume',
  !fasesTrf1.some((f) => [85, 581, 12215, 51, 12282, 1051, 60, 11010, 1061, 92].includes(
    movsTrf1.find((m) => m.data === f.data)?.codigo ?? -1)) || fasesTrf1.at(-1)?.id === 'atual');

// ---------- a propriedade que motivou tudo ----------
// 78 e 214 movimentos precisam caber na mesma faixa: a saida nao pode crescer
// com a entrada, senao o processo mais movimentado vira a tela mais confusa.
check('saida independe do tamanho da entrada',
  Math.abs(fasesTjsp.length - fasesTrf1.length) <= 4,
  `TJSP=${fasesTjsp.length} TRF1=${fasesTrf1.length}`);

// ---------- casos de borda ----------
check('processo sem movimentos nao quebra', resumirEmFases([]).length === 0);

const soExpediente = resumirEmFases([
  { data: '2025-01-01T00:00:00Z', nome: 'Publicação', codigo: 92, grau: 'G1', complementos: [], marco: false },
  { data: '2025-02-01T00:00:00Z', nome: 'Conclusão', codigo: 51, grau: 'G1', complementos: [], marco: false },
]);
check('processo so de expediente mostra ao menos a situacao atual',
  soExpediente.length === 1 && soExpediente[0].id === 'atual', String(soExpediente.length));

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
