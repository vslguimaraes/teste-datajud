// GET /functions/v1/processo/{numero}
//
// Recebe só o número do processo — o tribunal é deduzido dos dígitos, como o
// beta exige. Devolve a ficha estruturada, ou um estado explícito de por que
// não foi possível montá-la.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { parseNumero, rotearIndice, SEGMENTOS } from './cnj.ts';
import { buscar } from './datajud.ts';

// TTL do cache. Escolhido alto de propósito: o índice do DataJud é replicado
// em lote e costuma estar semanas ou meses atrasado, então reconsultar de hora
// em hora só gastaria a cota compartilhada do CNJ sem trazer novidade.
const TTL_HORAS = 6;

const CORS = {
  // Beta fechado: a página vive no GitHub Pages e só ela consome esta função.
  'Access-Control-Allow-Origin': Deno.env.get('ORIGEM_PERMITIDA') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(corpo: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(corpo, null, 2), {
    status,
    headers: { ...CORS, ...extra, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const entrada = decodeURIComponent(new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? '');

  // 1. Valida o número ANTES de gastar uma requisição na cota do CNJ.
  const p = parseNumero(entrada);
  if (!p.ok) {
    return json({ estado: 'numero_invalido', motivo: p.motivo, mensagem: p.detalhe }, 400);
  }
  const numero = p.numero;

  // 2. Deduz o índice a partir de J.TR embutidos no próprio número.
  const rota = rotearIndice(numero.segmento, numero.tribunal);
  if (!rota.ok) {
    return json({
      estado: 'tribunal_sem_indice',
      numeroFormatado: numero.formatado,
      segmento: SEGMENTOS[numero.segmento] ?? null,
      mensagem: rota.detalhe,
    }, 422);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 3. Cache. Uma falha aqui nunca derruba a consulta — no pior caso paga uma
  //    chamada a mais ao CNJ, o que é melhor que devolver erro ao usuário.
  try {
    const { data } = await supabase
      .from('consulta_cache')
      .select('estado, ficha, consultado_em, acertos')
      .eq('numero', numero.digitos)
      .gt('expira_em', new Date().toISOString())
      .maybeSingle();

    if (data) {
      supabase.from('consulta_cache')
        .update({ acertos: (data.acertos ?? 0) + 1 })
        .eq('numero', numero.digitos)
        .then(() => {}, () => {});
      return json({
        estado: data.estado,
        alias: rota.alias,
        ficha: data.ficha ?? undefined,
        origemDoDado: 'cache',
        consultadoEm: data.consultado_em,
      }, 200, { 'X-Cache': 'HIT' });
    }
  } catch (e) {
    console.error('cache indisponivel, seguindo para o DataJud:', e);
  }

  // 4. Consulta o DataJud.
  const apiKey = Deno.env.get('DATAJUD_APIKEY');
  if (!apiKey) {
    console.error('DATAJUD_APIKEY nao configurada');
    return json({ estado: 'erro_configuracao', mensagem: 'Serviço mal configurado.' }, 500);
  }

  let resultado;
  try {
    resultado = await buscar(rota.alias, numero, apiKey);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 429) {
      return json({
        estado: 'limite_excedido',
        mensagem: 'A cota de requisições do DataJud foi excedida. Tente em alguns minutos.',
      }, 429);
    }
    console.error('falha ao consultar o DataJud:', e);
    return json({
      estado: 'erro_upstream',
      mensagem: 'O DataJud não respondeu como esperado.',
      detalhe: status ? `HTTP ${status}` : String(e),
    }, 502);
  }

  const expira = new Date(Date.now() + TTL_HORAS * 3_600_000).toISOString();
  try {
    await supabase.from('consulta_cache').upsert({
      numero: numero.digitos,
      alias: rota.alias,
      estado: resultado.estado,
      ficha: resultado.ficha ?? null,
      consultado_em: new Date().toISOString(),
      expira_em: expira,
      acertos: 0,
    });
  } catch (e) {
    console.error('nao foi possivel gravar no cache:', e);
  }

  // "nao_indexado" nunca vira "processo nao existe": pela API pública é
  // impossível separar sigilo, número inexistente e lacuna de replicação.
  if (resultado.estado === 'nao_indexado') {
    return json({
      estado: 'nao_indexado',
      alias: rota.alias,
      numeroFormatado: numero.formatado,
      tribunalDeduzido: rota.alias.toUpperCase(),
      mensagem: 'Este processo não está no índice público do DataJud.',
      causasPossiveis: [
        'O processo tramita em segredo de justiça (a API pública só expõe processos sem sigilo).',
        'O tribunal ainda não replicou este processo para o DataJud.',
        'O número está correto na forma, mas não corresponde a um processo existente.',
      ],
      origemDoDado: 'datajud',
    }, 200, { 'X-Cache': 'MISS' });
  }

  return json({
    estado: 'encontrado',
    alias: rota.alias,
    ficha: resultado.ficha,
    origemDoDado: 'datajud',
  }, 200, { 'X-Cache': 'MISS' });
});
