import { parseNumero, rotearIndice } from '../cnj.ts';

let falhas = 0;
function check(rot: string, cond: boolean, extra = '') {
  console.log(`${cond ? 'PASS' : 'FALHA'}  ${rot}${extra ? '  ' + extra : ''}`);
  if (!cond) falhas++;
}

// Os dois processos reais que testamos contra a API.
const trf3 = parseNumero('5036221-02.2023.4.03.6100');
check('TRF3 parse', trf3.ok);
if (trf3.ok) {
  check('TRF3 digitos', trf3.numero.digitos === '50362210220234036100', trf3.numero.digitos);
  const r = rotearIndice(trf3.numero.segmento, trf3.numero.tribunal);
  check('TRF3 alias=trf3', r.ok && r.alias === 'trf3', JSON.stringify(r));
}

const tjsp = parseNumero('1083208-94.2023.8.26.0053');
check('TJSP parse', tjsp.ok);
if (tjsp.ok) {
  check('TJSP digitos', tjsp.numero.digitos === '10832089420238260053', tjsp.numero.digitos);
  const r = rotearIndice(tjsp.numero.segmento, tjsp.numero.tribunal);
  check('TJSP alias=tjsp', r.ok && r.alias === 'tjsp', JSON.stringify(r));
}

// Sem mascara deve dar o mesmo resultado.
const semMascara = parseNumero('10832089420238260053');
check('sem mascara equivale', semMascara.ok && tjsp.ok && semMascara.numero.formatado === tjsp.numero.formatado);

// Rejeicoes.
const dvRuim = parseNumero('5036221-03.2023.4.03.6100');
check('DV errado rejeitado', !dvRuim.ok && dvRuim.motivo === 'digito_verificador', dvRuim.ok ? '' : dvRuim.detalhe);
const curto = parseNumero('123');
check('tamanho errado rejeitado', !curto.ok && curto.motivo === 'tamanho');
check('vazio rejeitado', !parseNumero('').ok);

// Roteamento por segmento.
const casos: [string, string, string | null][] = [
  ['8', '07', 'tjdft'],   // DF e tjdft, nao tjdf
  ['8', '19', 'tjrj'],
  ['4', '01', 'trf1'],
  ['5', '02', 'trt2'],
  ['5', '00', 'tst'],
  ['6', '26', 'tre-sp'],
  ['6', '00', 'tse'],
  ['3', '00', 'stj'],
  ['7', '00', 'stm'],
  ['9', '26', 'tjmsp'],
  ['9', '19', null],      // nao ha JME no RJ
  ['4', '09', null],      // so existem 6 TRFs
  ['1', '00', null],      // STF fora da API publica
];
for (const [j, tr, esperado] of casos) {
  const r = rotearIndice(j, tr);
  const obtido = r.ok ? r.alias : null;
  check(`rota J=${j} TR=${tr}`, obtido === esperado, `-> ${obtido ?? 'recusado'}`);
}

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
