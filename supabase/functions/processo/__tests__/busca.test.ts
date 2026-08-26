import { readFileSync } from 'node:fs';
import { parseNumero, rotearIndice } from '../cnj.ts';
import { buscar } from '../datajud.ts';

const fonte = JSON.parse(readFileSync(new URL('./fixture-tjsp.json', import.meta.url), 'utf8'));
let falhas = 0;
const check = (r: string, c: boolean, x = '') => { console.log(`${c ? 'PASS' : 'FALHA'}  ${r}${x ? '  -> ' + x : ''}`); if (!c) falhas++; };

function fakeFetch(corpo: unknown, status = 200) {
  return async (_u: string, init: { body: string; headers: Record<string,string> }) => {
    // Confere que montamos a requisicao como o DataJud espera.
    const b = JSON.parse(init.body);
    check('busca por digitos, nao por mascara', /^\d{20}$/.test(b.query.match.numeroProcesso), b.query.match.numeroProcesso);
    check('header Authorization no formato APIKey', init.headers.Authorization.startsWith('APIKey '));
    return { ok: status === 200, status, json: async () => corpo } as unknown as Response;
  };
}

const p = parseNumero('1083208-94.2023.8.26.0053');
if (!p.ok) throw new Error('numero invalido');
const rota = rotearIndice(p.numero.segmento, p.numero.tribunal);
if (!rota.ok) throw new Error('rota invalida');

// Caso 1: processo encontrado (payload real do TJSP).
const achado = await buscar(rota.alias, p.numero,
  'chave-de-teste', fakeFetch({ hits: { hits: [{ _source: fonte }] } }));
check('estado encontrado', achado.estado === 'encontrado');
check('situacao derivada', achado.ficha?.situacao === 'em_andamento', achado.ficha?.situacaoDescricao);
check('ultimo movimento correto', achado.ficha?.ultimoMovimento?.data.startsWith('2026-03-26') === true);

// Caso 2: o cenario real do TRF3 - HTTP 200 com zero hits.
const vazio = await buscar('trf3', p.numero, 'chave-de-teste',
  fakeFetch({ hits: { total: { value: 0 }, hits: [] } }));
check('vazio vira nao_indexado, nao erro', vazio.estado === 'nao_indexado');
check('vazio nao traz ficha', vazio.ficha === undefined);

// Caso 3: dois graus do mesmo processo devem fundir numa ficha so.
const g2 = { ...fonte, id: 'TJSP_G2_x', grau: 'G2',
  dataHoraUltimaAtualizacao: '2026-06-01T00:00:00.000Z',
  orgaoJulgador: { codigo: 1, nome: '5a CAMARA DE DIREITO PUBLICO' },
  movimentos: [{ codigo: 123, nome: 'Remessa', dataHora: '2026-07-01T10:00:00.000Z' }] };
const doisGraus = await buscar('tjsp', p.numero, 'k',
  fakeFetch({ hits: { hits: [{ _source: fonte }, { _source: g2 }] } }));
check('funde os dois graus', doisGraus.ficha?.graus.join(',') === 'G1,G2', doisGraus.ficha?.graus.join(','));
check('cadastro vem da instancia mais recente',
  doisGraus.ficha?.orgaoJulgadorAtual === '5a CAMARA DE DIREITO PUBLICO', doisGraus.ficha?.orgaoJulgadorAtual ?? '');
check('timeline fundida e ordenada',
  doisGraus.ficha?.ultimoMovimento?.data.startsWith('2026-07-01') === true, doisGraus.ficha?.ultimoMovimento?.data);
check('movimento carrega etiqueta de grau',
  doisGraus.ficha?.ultimoMovimento?.grau === 'G2');

// Caso 4: erro do upstream vira excecao com status, para o handler traduzir.
try {
  await buscar('tjsp', p.numero, 'k', fakeFetch({}, 429));
  check('erro 429 propaga', false);
} catch (e) {
  check('erro 429 propaga com status', (e as { status: number }).status === 429);
}

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
