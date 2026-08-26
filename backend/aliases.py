#!/usr/bin/env python3
"""Roteamento de número CNJ -> índice do DataJud.

O número CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO) carrega o segmento da Justiça (J) e o
tribunal (TR). Isso permite deduzir o índice sem o usuário escolher o tribunal.

ATENÇÃO: as convenções de nome de alias abaixo são a MELHOR HIPÓTESE, não fato
verificado. Rode `probe_aliases.py` contra a API para confirmar cada uma antes
de subir. Aliases marcados como CONFIRMADO já foram vistos respondendo.
"""

CONFIRMADOS = {'trf3', 'tjsp'}  # observados respondendo em 25/08/2026

# UF por código TR, usado por Estadual (J=8), Eleitoral (J=6) e Militar
# Estadual (J=9) — a Res. CNJ 65/2008 usa a mesma tabela de UF nos três.
UF_POR_TR = {
    '01': 'ac', '02': 'al', '03': 'ap', '04': 'am', '05': 'ba', '06': 'ce',
    '07': 'df', '08': 'es', '09': 'go', '10': 'ma', '11': 'mt', '12': 'ms',
    '13': 'mg', '14': 'pa', '15': 'pb', '16': 'pr', '17': 'pe', '18': 'pi',
    '19': 'rj', '20': 'rn', '21': 'rs', '22': 'ro', '23': 'rr', '24': 'sc',
    '25': 'se', '26': 'sp', '27': 'to',
}

# Justiça Estadual: o TJ do DF é 'tjdft', não 'tjdf'.
ESTADUAL = {tr: ('tjdft' if uf == 'df' else f'tj{uf}') for tr, uf in UF_POR_TR.items()}

# Justiça Militar Estadual existe em apenas três estados.
MILITAR_ESTADUAL = {'13': 'tjmmg', '21': 'tjmrs', '26': 'tjmsp'}

SEGMENTOS = {
    '1': 'Supremo Tribunal Federal',
    '2': 'Conselho Nacional de Justiça',
    '3': 'Superior Tribunal de Justiça',
    '4': 'Justiça Federal',
    '5': 'Justiça do Trabalho',
    '6': 'Justiça Eleitoral',
    '7': 'Justiça Militar da União',
    '8': 'Justiça Estadual',
    '9': 'Justiça Militar Estadual',
}


def alias_para(j, tr):
    """Retorna (alias, confianca) ou (None, motivo) para um par J.TR."""
    if j == '1':
        return None, 'STF não é publicado na API pública do DataJud'
    if j == '2':
        return None, 'CNJ não possui índice de processos na API pública'
    if j == '3':
        return 'stj', 'hipotese'
    if j == '4':
        n = int(tr)
        if 1 <= n <= 6:
            return f'trf{n}', 'confirmado' if f'trf{n}' in CONFIRMADOS else 'hipotese'
        return None, f'TRF {tr} não existe (são 6 regiões)'
    if j == '5':
        if tr == '00':
            return 'tst', 'hipotese'
        n = int(tr)
        if 1 <= n <= 24:
            return f'trt{n}', 'hipotese'
        return None, f'TRT {tr} não existe (são 24 regiões)'
    if j == '6':
        if tr == '00':
            return 'tse', 'hipotese'
        uf = UF_POR_TR.get(tr)
        return (f'tre-{uf}', 'hipotese') if uf else (None, f'TRE {tr} desconhecido')
    if j == '7':
        return 'stm', 'hipotese'
    if j == '8':
        a = ESTADUAL.get(tr)
        if not a:
            return None, f'tribunal estadual {tr} desconhecido'
        return a, 'confirmado' if a in CONFIRMADOS else 'hipotese'
    if j == '9':
        a = MILITAR_ESTADUAL.get(tr)
        if not a:
            return None, f'não há Justiça Militar Estadual no tribunal {tr} (só MG, RS e SP)'
        return a, 'hipotese'
    return None, f'segmento {j} desconhecido'


def todos_os_aliases():
    """Enumera todos os aliases hipotéticos, para o probe validar."""
    vistos = {}
    for j in SEGMENTOS:
        for tr in [f'{n:02d}' for n in range(0, 28)]:
            a, _ = alias_para(j, tr)
            if a:
                vistos.setdefault(a, (j, tr))
    return vistos


if __name__ == '__main__':
    todos = todos_os_aliases()
    por_segmento = {}
    for alias, (j, tr) in todos.items():
        por_segmento.setdefault(j, []).append(alias)
    for j in sorted(por_segmento):
        nomes = sorted(por_segmento[j])
        print(f'J={j} {SEGMENTOS[j]}: {len(nomes)}')
        print(f'  {" ".join(nomes)}')
    print(f'\nTOTAL: {len(todos)} aliases hipoteticos')
