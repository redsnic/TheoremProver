#!/bin/sh

# Shared environment for this repository's project-local Archon and Lean tools.
# The calling wrapper must set THEOREM_PROVER_BIN_DIR before sourcing this file.

if [ -z "${THEOREM_PROVER_BIN_DIR:-}" ]; then
  echo "THEOREM_PROVER_BIN_DIR is not set" >&2
  exit 1
fi

THEOREM_PROVER_ROOT=$(CDPATH= cd -- "$THEOREM_PROVER_BIN_DIR/.." && pwd)
export THEOREM_PROVER_ROOT
export ELAN_HOME="$THEOREM_PROVER_ROOT/.tools/elan"
export PATH="$THEOREM_PROVER_ROOT/.tools/node/bin:$THEOREM_PROVER_ROOT/.venv/bin:$THEOREM_PROVER_ROOT/.tools/bin:$ELAN_HOME/bin:$PATH"
export ARCHON_CLI_BIN="$THEOREM_PROVER_ROOT/.venv/bin/archon"
export ARCHON_PYTHON="$THEOREM_PROVER_ROOT/.venv/bin/python"
export ARCHON_UV_BIN="$THEOREM_PROVER_ROOT/.tools/bin/uv"

if [ -z "${ARCHON_CODEX_BIN:-}" ]; then
  if command -v codex >/dev/null 2>&1; then
    ARCHON_CODEX_BIN=$(command -v codex)
  else
    for candidate in "$HOME"/.vscode/extensions/openai.chatgpt-*/bin/macos-aarch64/codex; do
      if [ -x "$candidate" ]; then
        ARCHON_CODEX_BIN=$candidate
      fi
    done
  fi
fi

if [ -n "${ARCHON_CODEX_BIN:-}" ]; then
  export ARCHON_CODEX_BIN
  CODEX_BIN=$ARCHON_CODEX_BIN
  export CODEX_BIN
  PATH="$(dirname -- "$ARCHON_CODEX_BIN"):$PATH"
  export PATH
fi

export RETHLAS_ROOT="$THEOREM_PROVER_ROOT/rethlas"
export RETHLAS_PYTHON="$THEOREM_PROVER_ROOT/.rethlas-venv/bin/python"
