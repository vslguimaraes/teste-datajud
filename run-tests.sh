#!/usr/bin/env bash
# Suite completa. Nao toca na rede: usa fixtures do retorno real do DataJud.
set -e
cd "$(dirname "$0")"
falhou=0
for t in supabase/functions/processo/__tests__/*.test.ts; do
  echo "=== $t"
  node --experimental-strip-types "$t" 2>&1 | grep -v ExperimentalWarning | grep -v "^(node" || falhou=1
done
exit $falhou
