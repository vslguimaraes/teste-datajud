// Numeração unificada do CNJ (Res. 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO
//
// O beta busca só pelo número, sem o usuário escolher tribunal. Isso é possível
// porque J (segmento da Justiça) e TR (tribunal) estão dentro do próprio número
// e determinam qual índice do DataJud consultar.

export type Segmento = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

export interface NumeroCNJ {
  digitos: string;        // 20 dígitos, como o DataJud indexa
  formatado: string;      // com máscara, para exibição
  sequencial: string;
  dv: string;
  ano: string;
  segmento: Segmento;
  tribunal: string;
  origem: string;
}

export const SEGMENTOS: Record<string, string> = {
  '1': 'Supremo Tribunal Federal',
  '2': 'Conselho Nacional de Justiça',
  '3': 'Superior Tribunal de Justiça',
  '4': 'Justiça Federal',
  '5': 'Justiça do Trabalho',
  '6': 'Justiça Eleitoral',
  '7': 'Justiça Militar da União',
  '8': 'Justiça Estadual',
  '9': 'Justiça Militar Estadual',
};

// A Res. 65/2008 usa a mesma tabela de UF por TR na Justiça Estadual,
// Eleitoral e Militar Estadual.
const UF_POR_TR: Record<string, string> = {
  '01': 'ac', '02': 'al', '03': 'ap', '04': 'am', '05': 'ba', '06': 'ce',
  '07': 'df', '08': 'es', '09': 'go', '10': 'ma', '11': 'mt', '12': 'ms',
  '13': 'mg', '14': 'pa', '15': 'pb', '16': 'pr', '17': 'pe', '18': 'pi',
  '19': 'rj', '20': 'rn', '21': 'rs', '22': 'ro', '23': 'rr', '24': 'sc',
  '25': 'se', '26': 'sp', '27': 'to',
};

const MILITAR_ESTADUAL: Record<string, string> = {
  '13': 'tjmmg', '21': 'tjmrs', '26': 'tjmsp',
};

/**
 * Dígito verificador pelo módulo 97 base 10 (ISO 7064).
 *
 * A conta é feita em pedaços porque o número montado tem 20 dígitos e
 * estouraria a precisão de um Number do JavaScript. Como (a·10^k + b) mod 97
 * pode ser calculado incrementalmente, processamos dígito a dígito.
 */
function modulo97(s: string): number {
  let resto = 0;
  for (const ch of s) resto = (resto * 10 + (ch.charCodeAt(0) - 48)) % 97;
  return resto;
}

export function dvEsperado(n: Omit<NumeroCNJ, 'dv' | 'digitos' | 'formatado'>): string {
  const base = `${n.sequencial}${n.ano}${n.segmento}${n.tribunal}${n.origem}00`;
  return String(98 - modulo97(base)).padStart(2, '0');
}

export type ParseResultado =
  | { ok: true; numero: NumeroCNJ }
  | { ok: false; motivo: string; detalhe: string };

/** Aceita com ou sem máscara. Valida tamanho e dígito verificador. */
export function parseNumero(entrada: string): ParseResultado {
  const digitos = (entrada ?? '').replace(/\D/g, '');

  if (digitos.length === 0) {
    return { ok: false, motivo: 'vazio', detalhe: 'Informe um número de processo.' };
  }
  if (digitos.length !== 20) {
    return {
      ok: false,
      motivo: 'tamanho',
      detalhe: `O número CNJ tem 20 dígitos; foram informados ${digitos.length}.`,
    };
  }

  const parcial = {
    sequencial: digitos.slice(0, 7),
    ano: digitos.slice(9, 13),
    segmento: digitos.slice(13, 14) as Segmento,
    tribunal: digitos.slice(14, 16),
    origem: digitos.slice(16, 20),
  };
  const dv = digitos.slice(7, 9);
  const esperado = dvEsperado(parcial);

  if (dv !== esperado) {
    return {
      ok: false,
      motivo: 'digito_verificador',
      detalhe: `Dígito verificador inválido: informado ${dv}, esperado ${esperado}. Confira a digitação.`,
    };
  }

  const { sequencial, ano, segmento, tribunal, origem } = parcial;
  return {
    ok: true,
    numero: {
      digitos,
      formatado: `${sequencial}-${dv}.${ano}.${segmento}.${tribunal}.${origem}`,
      sequencial, dv, ano, segmento, tribunal, origem,
    },
  };
}

export type RotaResultado =
  | { ok: true; alias: string }
  | { ok: false; detalhe: string };

/** Traduz J.TR no alias do índice DataJud (api_publica_<alias>). */
export function rotearIndice(segmento: string, tribunal: string): RotaResultado {
  const n = Number(tribunal);
  switch (segmento) {
    case '1':
      return { ok: false, detalhe: 'O STF não é publicado na API pública do DataJud.' };
    case '2':
      return { ok: false, detalhe: 'O CNJ não possui índice de processos na API pública.' };
    case '3':
      return { ok: true, alias: 'stj' };
    case '4':
      return n >= 1 && n <= 6
        ? { ok: true, alias: `trf${n}` }
        : { ok: false, detalhe: `TRF ${tribunal} não existe (são 6 regiões).` };
    case '5':
      if (tribunal === '00') return { ok: true, alias: 'tst' };
      return n >= 1 && n <= 24
        ? { ok: true, alias: `trt${n}` }
        : { ok: false, detalhe: `TRT ${tribunal} não existe (são 24 regiões).` };
    case '6': {
      if (tribunal === '00') return { ok: true, alias: 'tse' };
      const uf = UF_POR_TR[tribunal];
      return uf
        ? { ok: true, alias: `tre-${uf}` }
        : { ok: false, detalhe: `TRE ${tribunal} desconhecido.` };
    }
    case '7':
      return { ok: true, alias: 'stm' };
    case '8': {
      const uf = UF_POR_TR[tribunal];
      if (!uf) return { ok: false, detalhe: `Tribunal estadual ${tribunal} desconhecido.` };
      return { ok: true, alias: uf === 'df' ? 'tjdft' : `tj${uf}` };
    }
    case '9': {
      const a = MILITAR_ESTADUAL[tribunal];
      return a
        ? { ok: true, alias: a }
        : { ok: false, detalhe: 'Justiça Militar Estadual existe apenas em MG, RS e SP.' };
    }
    default:
      return { ok: false, detalhe: `Segmento ${segmento} desconhecido.` };
  }
}
