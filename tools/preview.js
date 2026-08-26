const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');

// Ficha real do TJSP, na forma exata que a funcao devolve.
const fonte = require('/home/user/teste-datajud/supabase/functions/processo/__tests__/fixture-tjsp.json');
const movs = fonte.movimentos.map(m => ({
  data: new Date(m.dataHora).toISOString(),
  nome: m.nome, codigo: m.codigo, grau: 'G1',
  orgao: m.orgaoJulgador?.nome,
  complementos: (m.complementosTabelados ?? []).map(c => c.nome),

})).sort((a,b) => a.data.localeCompare(b.data));

const ENCONTRADO = { estado:'encontrado', alias:'tjsp', origemDoDado:'datajud', ficha:{
  numero:'10832089420238260053', numeroFormatado:'1083208-94.2023.8.26.0053',
  tribunal:'TJSP', graus:['G1'], classe:'Procedimento Comum Cível',
  assuntos:['Repetição de indébito','Invalidez Permanente','CPF/Cadastro de Pessoas Físicas'],
  orgaoJulgadorAtual:'13 FAZENDA PUBLICA DE CENTRAL', sistema:'SAJ',
  dataAjuizamento:'2023-12-05T13:53:23.000Z', sigiloso:false,
  situacao:'em_andamento', situacaoDescricao:'Em andamento, sem julgamento nem baixa registrados',
  ultimoMovimento: movs[movs.length-1],
  atualizadoEm:'2026-04-28T04:55:55.885Z', atualizadoHaDias:120, dadoDefasado:true,
  totalMovimentos: movs.length, fases: JSON.parse(execFileSync('node',
    ['--experimental-strip-types', '-e',
     "import('./supabase/functions/processo/fases.ts').then(m=>console.log(JSON.stringify(m.resumirEmFases(JSON.parse(process.argv[1])))))",
     JSON.stringify(movs)], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] })),
  movimentos: movs,
}};

const NAO_INDEXADO = { estado:'nao_indexado', alias:'trf3',
  numeroFormatado:'5036221-02.2023.4.03.6100', tribunalDeduzido:'TRF3',
  mensagem:'Este processo não está no índice público do DataJud.',
  causasPossiveis:[
    'O processo tramita em segredo de justiça (a API pública só expõe processos sem sigilo).',
    'O tribunal ainda não replicou este processo para o DataJud.',
    'O número está correto na forma, mas não corresponde a um processo existente.',
  ]};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const url = 'file://' + path.resolve('docs/index.html');

  for (const [nome, resposta, numero, tema] of [
    ['1-inicial', null, '', 'light'], ['1-inicial-dark', null, '', 'dark'],
    ['2-encontrado',   ENCONTRADO,    '1083208-94.2023.8.26.0053',   'light'],
    ['3-encontrado-dark', ENCONTRADO, '1083208-94.2023.8.26.0053',   'dark' ],
    ['4-nao-indexado', NAO_INDEXADO,  '5036221-02.2023.4.03.6100',   'light'],
  ]) {
    const page = await browser.newPage({
      viewport: { width: 860, height: 1000 },
      colorScheme: tema, deviceScaleFactor: 2,
    });
    if (resposta) {
      await page.addInitScript((r) => {
        window.fetch = async () => ({ json: async () => r });
      }, resposta);
    }
    await page.goto(url);
    if (numero) {
      await page.fill('#entrada', numero);
      await page.click('#botao');
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `capturas/${nome}.png`, fullPage: !!resposta });
    // Confere o que de fato foi renderizado.
    if (resposta?.estado === 'encontrado') {
      const marcos = await page.locator('#linha .mov').count();  // agora = fases
      // Conta a CLASSE, nao o tamanho da lista: #linha ja vem filtrado pelo
      // dado, entao seu tamanho nao prova que o destaque visual funciona.
      const destacados = await page.locator('#linha .mov.marco').count();
      const total  = await page.locator('#linha-tudo .mov').count();
      const badge  = await page.locator('.pastilha').innerText();
      const aviso  = await page.locator('.selo.velho').count();
      console.log(`${nome}: badge="${badge}" marcos=${marcos} destacados=${destacados} total=${total} avisoDefasagem=${aviso}`);
      // No CI isto precisa reprovar, nao so informar.
      const problemas = [];
      if (!badge) problemas.push('sem pastilha de situacao');
      if (marcos < 1) problemas.push('nenhum marco destacado');
      if (marcos >= total) problemas.push('marcos nao filtram nada');
      if (destacados !== marcos) problemas.push(`${marcos} na lista de marcos mas ${destacados} com destaque visual`);
      if (!aviso) problemas.push('sem aviso de defasagem');
      if (problemas.length) { console.error(`FALHA em ${nome}: ${problemas.join('; ')}`); process.exitCode = 1; }
      await page.click('#alternar');
      console.log(`  apos alternar: visiveis=${await page.locator('#linha-tudo .mov').count()} rotulo="${await page.locator('#alternar').innerText()}"`);
    }
    await page.close();
  }
  await browser.close();
  console.log('screenshots gerados');
})();
