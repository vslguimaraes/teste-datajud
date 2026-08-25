#!/usr/bin/env python3
"""Valida o dígito verificador de números de processo no padrão CNJ.

Formato: NNNNNNN-DD.AAAA.J.TR.OOOO (Res. CNJ 65/2008)
DV = 98 - (NNNNNNN AAAA J TR OOOO 00  mod  97)

Serve para separar "número digitado errado" de "processo não indexado"
antes de culpar a API do DataJud.
"""
import re
import sys

PADRAO = re.compile(r'^(\d{7})-?(\d{2})\.?(\d{4})\.?(\d)\.?(\d{2})\.?(\d{4})$')

SEGMENTOS = {
    '1': 'STF', '2': 'CNJ', '3': 'STJ', '4': 'Justiça Federal',
    '5': 'Justiça do Trabalho', '6': 'Justiça Eleitoral',
    '7': 'Justiça Militar da União', '8': 'Justiça Estadual',
    '9': 'Justiça Militar Estadual',
}

# Alias do índice DataJud a partir de J.TR.
ALIAS_JF = {f'{n:02d}': f'trf{n}' for n in range(1, 7)}
ALIAS_ESTADUAL = {
    '01': 'tjac', '02': 'tjal', '03': 'tjap', '04': 'tjam', '05': 'tjba',
    '06': 'tjce', '07': 'tjdft', '08': 'tjes', '09': 'tjgo', '10': 'tjma',
    '11': 'tjmt', '12': 'tjms', '13': 'tjmg', '14': 'tjpa', '15': 'tjpb',
    '16': 'tjpr', '17': 'tjpe', '18': 'tjpi', '19': 'tjrj', '20': 'tjrn',
    '21': 'tjrs', '22': 'tjro', '23': 'tjrr', '24': 'tjsc', '25': 'tjse',
    '26': 'tjsp', '27': 'tjto',
}


def validar(numero):
    limpo = re.sub(r'\D', '', numero)
    if len(limpo) != 20:
        return None, f'esperados 20 dígitos, encontrados {len(limpo)}'

    seq, dv, ano, j, tr, origem = (
        limpo[0:7], limpo[7:9], limpo[9:13], limpo[13], limpo[14:16], limpo[16:20]
    )
    calculado = 98 - (int(f'{seq}{ano}{j}{tr}{origem}00') % 97)

    alias = ALIAS_JF.get(tr) if j == '4' else ALIAS_ESTADUAL.get(tr) if j == '8' else None

    return {
        'digitos': limpo,
        'sequencial': seq,
        'dv_informado': dv,
        'dv_calculado': f'{calculado:02d}',
        'valido': f'{calculado:02d}' == dv,
        'ano': ano,
        'segmento': SEGMENTOS.get(j, f'desconhecido ({j})'),
        'tribunal': tr,
        'origem': origem,
        'alias_datajud': alias,
    }, None


def main(argv):
    numeros = argv[1:] or [
        '5036221-02.2023.4.03.6100',
        '1083208-94.2023.8.26.0053',
    ]
    falhou = False
    for numero in numeros:
        info, erro = validar(numero)
        if erro:
            print(f'{numero}: FORMATO INVÁLIDO - {erro}')
            falhou = True
            continue

        marca = 'VÁLIDO' if info['valido'] else f"INVÁLIDO (DV deveria ser {info['dv_calculado']})"
        falhou = falhou or not info['valido']
        alias = info['alias_datajud'] or '(sem alias mapeado)'
        print(f"{numero}")
        print(f"  DV           : informado={info['dv_informado']} calculado={info['dv_calculado']} -> {marca}")
        print(f"  Segmento     : {info['segmento']} / tribunal {info['tribunal']}")
        print(f"  Ano / origem : {info['ano']} / {info['origem']}")
        print(f"  Índice       : api_publica_{alias}")
        print(f"  Buscar por   : {info['digitos']}")
        print()

    return 1 if falhou else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
