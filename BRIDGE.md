# Codex theorem-proving bridge

Pinned and packaged for reproducible project-local installation. Run
`./bin/start` after cloning; it invokes setup when needed, authenticates Codex,
and opens Proof Studio. The setup script installs the versions below and applies
the versioned overlay under `vendor/archon-overlay/`.

## Components

- Archon 0.3.3, upstream commit `5e9ae7615efa0aa2cff11edabd5fbc0d45308fd5`
- Rethlas, upstream commit `887cc46427636bbdd235160a112f9a30ae81d040`
- Lean 4.32.2 and Mathlib 4.32.2
- Python 3.12.13 environments for Archon and Rethlas
- Node.js 24.16.0 LTS for the Archon dashboard
- Codex authentication through the machine's existing ChatGPT login
- Rethlas `cryptography` 48.0.0, the last release with a universal macOS wheel

## Local safety changes

- All Archon roles use the `codex` harness with `workspace-write`.
- Archon defaults to two serial iterations, one agent at a time.
- Archon's axiom sweep is enabled.
- Rethlas generation and verification no longer use
  `--dangerously-bypass-approvals-and-sandbox`; both use `workspace-write`.
- Rethlas's verifier binds to `127.0.0.1`, not all network interfaces.
- Rethlas defaults to two iterations through the local wrapper.
- The dashboard binds to `127.0.0.1` by default because Proof Studio can launch
  the local Rethlas and Archon runners. Set `ARCHON_DASHBOARD_HOST` explicitly
  only when you have added an authenticated reverse proxy.
- Claude Code was not installed.

## Upstream compatibility notes

Archon 0.3.3's initializer still invokes Claude plugin registration in one
Codex-only path, and its built-in doctor unconditionally treats a missing
Claude executable/config as an error. The installed Archon package contains a
small local initializer compatibility patch, and `./bin/doctor` replaces the
Claude-specific doctor with a Codex-aware end-to-end check.

Reinstalling or updating Archon without running `./bin/setup` may overwrite the
local Proof Studio dashboard extension. Review a new upstream release before
changing the pinned revision, then update and test the overlay against it. The
explicit `workspace-write` project configuration remains in the ignored local
`.archon/config.json`.

## Deliberately optional pieces

- API keys for Archon's optional one-shot informal helper are unset. Native
  Codex/ChatGPT login is sufficient for the configured Archon and Rethlas
  agents.
- LeanBlueprint's TeX/PDF toolchain is not installed. It is optional for proof
  generation and Lean verification; Archon's live dashboard is installed.
- Matlas/LeanSearch retrieval is an external service and requires internet
  access when Rethlas uses theorem search.
