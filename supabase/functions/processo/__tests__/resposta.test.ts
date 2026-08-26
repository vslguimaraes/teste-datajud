// Garante que cache e consulta nova devolvam exatamente a mesma forma.
import { corpoResposta } from '../resposta.ts';

let falhas = 0;
const check = (r: string, c: boolean, x = '') => {
  console.log(`${c ? 'PASS' : 'FALHA'}  ${r}${x ? '  -> ' + x : ''}`); if (!c) falhas++;
};

const numero = { formatado: '0003865-33.2026.8.17.2730' };

// O caso que quebrou em producao: TJPE, servido do cache.
const doCache = corpoResposta('nao_indexado', undefined, 'tjpe', numero);
const doDatajud = corpoResposta('nao_indexado', undefined, 'tjpe', numero);

check('cache e datajud tem as mesmas chaves',
  JSON.stringify(Object.keys(doCache).sort()) === JSON.stringify(Object.keys(doDatajud).sort()));

// Os campos que sumiam e viravam "undefined" na tela.
check('traz numeroFormatado', doCache.numeroFormatado === numero.formatado, String(doCache.numeroFormatado));
check('traz tribunalDeduzido', doCache.tribunalDeduzido === 'TJPE', String(doCache.tribunalDeduzido));
check('traz 3 causas possiveis', doCache.causasPossiveis?.length === 3, String(doCache.causasPossiveis?.length));
check('traz mensagem', typeof doCache.mensagem === 'string' && doCache.mensagem.length > 0);

// Nenhum campo pode chegar como undefined: e assim que "undefined" vaza pro texto.
check('nenhum campo undefined',
  Object.entries(doCache).every(([, v]) => v !== undefined),
  Object.entries(doCache).filter(([, v]) => v === undefined).map(([k]) => k).join(',') || 'nenhum');

// A tela nunca pode afirmar que o processo nao existe.
const texto = JSON.stringify(doCache).toLowerCase();
check('nao afirma que o processo nao existe',
  !/n[aã]o existe(?!nte)/.test(texto.replace(/n[aã]o corresponde a um processo existente/g, '')));

const achado = corpoResposta('encontrado', { totalMovimentos: 78 }, 'tjsp', numero);
check('encontrado carrega a ficha', (achado.ficha as { totalMovimentos: number }).totalMovimentos === 78);
check('encontrado nao carrega causas', !('causasPossiveis' in achado));

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
