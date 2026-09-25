#!/bin/bash
# the whole suite (CLAUDE.md workflow step 2); prints one line per test file
export NODE_PATH="$(npm root -g)"
cd "$(dirname "$0")/.."
r=$(node test/test.js 2>&1 | tail -1); echo "test.js: $r"
for t in ui3 ui5 ui6 ui7 ui8 ui9 ui10 ui11 ui2022 guidex plan ws2 outputs wsoverlap wsstress final dims caps elevpick handle join corner capbtn overlap capdxf cap3d; do
  out=$(node test/$t.js 2>&1); echo "$out" > test/run_$t.log
  echo "$t: $(echo "$out" | grep -E 'ALL PASS|FAILURES|TOTAL' | tail -1) $(echo "$out" | grep -c '^FAIL')"
done
