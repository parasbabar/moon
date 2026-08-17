#!/bin/bash
# Midnight Verify — Compact compiler invocation
#
# Usage (from Windows):
#   wsl -d Ubuntu -- bash "/mnt/d/Midnight Verify/contract/compile.sh"
#
# What this does:
#   Compiles contract/src/age_verify.compact with compactc 0.31.0.
#
#   The compiler writes to managed/age_verify/ with this layout:
#     contract/index.js       ← real Contract class (import this in tests)
#     contract/index.d.ts     ← TypeScript declarations
#     contract/index.js.map   ← source map
#     compiler/contract-info.json ← metadata
#     keys/                   ← ZK prover/verifier keys
#     zkir/                   ← ZK IR bytecode
#
# After running, all imports should point to:
#   ./managed/age_verify/contract/index.js

set -euo pipefail

COMPACT="$HOME/.local/bin/compact"
CONTRACT_SRC="/mnt/d/Midnight Verify/contract/src/age_verify.compact"
OUTPUT_DIR="/mnt/d/Midnight Verify/contract/src/managed/age_verify"

echo "=== Midnight Verify — Compact Compilation ==="
echo "Compiler:  $($COMPACT compile --version)"
echo "Runtime:   $($COMPACT compile --runtime-version)"
echo "Ledger:    $($COMPACT compile --ledger-version)"
echo "Source:    $CONTRACT_SRC"
echo "Output:    $OUTPUT_DIR"
echo ""

$COMPACT compile "$CONTRACT_SRC" "$OUTPUT_DIR"

echo ""
echo "=== Compilation complete ==="
echo ""
echo "Generated files:"
find "$OUTPUT_DIR" -type f | sort
echo ""
echo "=== contract-info.json ==="
cat "$OUTPUT_DIR/compiler/contract-info.json"
