#!/usr/bin/env bash
# Suite completa. Nao toca na rede: usa fixtures do retorno real do DataJud.
set -e
cd "$(dirname "$0")"

# Codigo depois de process.exit() nunca roda. Isso ja aconteceu: sete
# assercoes ficaram mortas num arquivo por terem sido anexadas ao fim,
# e a suite continuou verde mentindo que as cobria.
for t in supabase/functions/processo/__tests__/*.test.ts; do
  linha=$(grep -n 'process.exit' "$t" | head -1 | cut -d: -f1)
  total=$(wc -l < "$t")
  if [ -n "$linha" ] && [ "$((total - linha))" -gt 1 ]; then
    echo "ERRO: $t tem $((total - linha)) linhas depois do process.exit da linha $linha."
    echo "      Essas assercoes nunca executam. Mova o fecho para o fim do arquivo."
    exit 1
  fi
done

falhou=0
for t in supabase/functions/processo/__tests__/*.test.ts; do
  echo "=== $t"
  node --experimental-strip-types "$t" 2>&1 | grep -v ExperimentalWarning | grep -v "^(node" || falhou=1
done
exit $falhou
