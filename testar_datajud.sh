#!/usr/bin/env bash
# Teste da API Pública do DataJud (CNJ)
# Uso: ./testar_datajud.sh
set -uo pipefail

BASE="https://api-publica.datajud.cnj.jus.br"
# Chave pública de teste divulgada pelo CNJ. Pode ser sobrescrita via env.
APIKEY="${DATAJUD_APIKEY:-cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==}"

# alias|numero com máscara
PROCESSOS=(
  "trf3|5036221-02.2023.4.03.6100"
  "tjsp|1083208-94.2023.8.26.0053"
)

buscar() {
  local alias="$1" numero="$2" rotulo="$3"
  local url="${BASE}/api_publica_${alias}/_search"
  local body="{\"query\":{\"match\":{\"numeroProcesso\":\"${numero}\"}}}"

  echo "--------------------------------------------------------------"
  echo "Tribunal : ${alias}"
  echo "Formato  : ${rotulo}"
  echo "Número   : ${numero}"
  echo "URL      : ${url}"
  echo "Body     : ${body}"

  local resp code json
  resp=$(curl -sS -w $'\n__HTTP__%{http_code}' \
    -X POST "${url}" \
    -H "Authorization: APIKey ${APIKEY}" \
    -H "Content-Type: application/json" \
    --max-time 30 \
    -d "${body}" 2>&1)
  local rc=$?

  if [ $rc -ne 0 ]; then
    echo "ERRO DE REDE/CURL (exit ${rc}): ${resp}"
    return
  fi

  code="${resp##*__HTTP__}"
  json="${resp%$'\n'__HTTP__*}"
  echo "HTTP     : ${code}"

  if [ "${code}" != "200" ]; then
    echo "ERRO HTTP. Corpo da resposta:"
    echo "${json}" | head -c 2000
    echo
    return
  fi

  local total
  total=$(echo "${json}" | jq -r '.hits.total.value // 0' 2>/dev/null || echo "?")
  echo "Hits     : ${total}"

  if [ "${total}" = "0" ]; then
    echo "RESULTADO VAZIO (nenhum processo encontrado)."
    return
  fi

  echo "Resumo dos hits:"
  echo "${json}" | jq -r '.hits.hits[]._source | {
      numeroProcesso,
      tribunal,
      classe: .classe.nome,
      orgaoJulgador: .orgaoJulgador.nome,
      grau,
      dataAjuizamento,
      ultimaAtualizacao: .dataHoraUltimaAtualizacao,
      assuntos: [.assuntos[]?.nome],
      ultimosMovimentos: ( [ .movimentos[]? | {data: .dataHora, nome: .nome} ] | sort_by(.data) | reverse | .[0:5] )
    }'
  echo
  echo "JSON completo:"
  echo "${json}" | jq .
}

for item in "${PROCESSOS[@]}"; do
  alias="${item%%|*}"
  mascarado="${item##*|}"
  digitos="${mascarado//[^0-9]/}"

  echo
  echo "=============================================================="
  echo "PROCESSO ${mascarado} (${alias})"
  echo "=============================================================="
  # O DataJud indexa numeroProcesso apenas com dígitos (20 posições).
  buscar "${alias}" "${digitos}" "somente dígitos (esperado funcionar)"
  buscar "${alias}" "${mascarado}" "com máscara (controle)"
done
