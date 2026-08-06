# TheoremProver

<!-- archon:readme -->

[![Lean Action CI](https://github.com/redsnic/TheoremProver/actions/workflows/lean_action_ci.yml/badge.svg)](https://github.com/redsnic/TheoremProver/actions/workflows/lean_action_ci.yml)
[![Lean API documentation](https://img.shields.io/badge/docs-Lean_API-4f46e5)](https://redsnic.github.io/TheoremProver/)

TheoremProver is a local, confirmation-gated workflow that turns a mathematical
problem into a human-readable proof blueprint and a machine-checked Lean 4
proof. It connects four components:

1. **Codex** operates the reasoning and formalization agents using the user's
   existing ChatGPT/Codex login.
2. **Rethlas** generates and independently checks an informal proof blueprint.
3. **Archon** plans, writes, and reviews the Lean formalization.
4. **Lean 4 + Mathlib** compile the final theorem and check that it contains no
   `sorry` placeholders or unexpected axioms.

The included **Proof Studio** dashboard makes the pipeline usable from a local
web interface. It locks the original request after confirmation, pauses again
for approval of the exact Lean theorem signature, highlights live progress,
and keeps every expensive action user-controlled. Historical requests can be
viewed, edited into new runs, and rerun. Verified blueprints can also be
expanded on demand into detailed, step-by-step mathematical explanations.

## Safety model

- The dashboard listens on `127.0.0.1` by default.
- Rethlas's verification service also listens on loopback only.
- Codex agents run with `workspace-write`; unsafe approval-bypass flags are not
  used.
- Only one confirmed proof workflow occupies the expensive pipeline at once.
- Requests and theorem signatures are hashed before downstream agents run.
- Confirmed theorem signatures are protected in `archon-protected.yaml`.
- Local requests, logs, credentials, virtual environments, and generated agent
  state are excluded from Git.

This is an agentic research tool. Review theorem statements before confirming
them and inspect the final Lean declaration before relying on a result.

## Online documentation

GitHub Pages publishes the project's static, generated Lean API documentation:

**https://redsnic.github.io/TheoremProver/**

This site lets readers browse the formal Lean modules, declarations, theorem
signatures, and source documentation. It is intentionally not the interactive
Proof Studio dashboard: Proof Studio can launch local Codex, Rethlas, and Archon
processes, so it remains loopback-only and must be run on the user's machine.

## Requirements

The supported setup is macOS or Linux with Git, `curl`, `tar`, and a SHA-256
utility (`shasum` or `sha256sum`). Everything else is installed into
project-local directories; no global Python or Node.js environment is changed.

## Quick start — one command

Paste this into a terminal:

```bash
git clone https://github.com/redsnic/TheoremProver.git && cd TheoremProver && ./bin/start
```

The first run installs any missing project-local tools and packages, including
Node.js, the [Codex CLI](https://developers.openai.com/codex/cli/), Python 3.12,
`uv`, Elan, Lean, Mathlib, Archon, and Rethlas. If Codex is not authenticated,
the command opens its browser sign-in flow. It then launches Proof Studio.

After the repository has been cloned, the same launcher is simply:

```bash
./bin/start
```

Setup downloads several toolchains and can take several minutes the first time.
Later launches reuse the completed installation.

The repository may be installed in a directory whose path contains spaces.

On Apple Silicon, the launcher detects terminals running through Rosetta and
restarts itself natively. It also repairs Intel binaries left by an interrupted
older setup, so an M-series Mac does not need Homebrew OpenSSL or Rust.

## Manual setup and verification

```bash
git clone https://github.com/redsnic/TheoremProver.git
cd TheoremProver
./bin/setup
```

The setup script:

- installs project-local Node.js and Codex when suitable versions are not
  already available;
- installs project-local `uv` and Elan;
- creates isolated Archon and Rethlas Python environments;
- installs pinned Archon 0.3.3 sources;
- applies and builds the versioned Proof Studio overlay;
- configures Codex as Archon's serial, bounded agent harness; and
- downloads the Mathlib cache and builds the Lean project.

The setup command installs dependencies but does not authenticate Codex or
launch a proof-generation run.

Verify the installation:

```bash
./bin/doctor
```

## Run Proof Studio

```bash
./bin/start
```

If the browser does not open automatically, visit:

```text
http://127.0.0.1:8080/new-theorem
```

Then:

1. Enter a title, slug, iteration budget, and Markdown problem.
2. Review and lock the exact request.
3. Wait while Rethlas generates and verifies the informal blueprint.
4. Review the proposed human meaning, assumptions, and exact Lean statement.
5. Approve the statement to start Archon, or request a corrected statement.
6. Monitor the highlighted five-stage timeline until Lean verification finishes.

**New Theorem** is the default tab. **History** keeps every request together
with its verified blueprint, detailed explanation, and proposed Lean statement.
The header also shows Codex login status and provides a confirmation-gated
button for shutting down the local dashboard and its active worker processes.

Each completed job also provides:

- **View request** for the complete immutable input and run metadata;
- **Edit & rerun** to create a new editable run from an earlier request; and
- **Explain proof** for an optional, persisted, step-by-step explanation of the
  verified human-readable proof.

See [PROOF_STUDIO.md](PROOF_STUDIO.md) for the full interface guide.

## Command-line workflow

Create a Markdown problem under `rethlas/agents/generation/data/`, then run:

```bash
./bin/rethlas data/my_problem.md 2
```

The final argument is the maximum number of Rethlas iterations. Import the
verified result and start formalization with:

```bash
./bin/import-rethlas my_problem
./bin/archon discuss .
./bin/archon loop .
```

Build or check Lean directly with:

```bash
./bin/lake build
./bin/lean TheoremProver/Basic.lean
```

## Repository layout

- `TheoremProver/` — Lean source files
- `rethlas/` — pinned and safety-adjusted Rethlas workflow
- `vendor/archon-overlay/` — reproducible Proof Studio dashboard extension
- `references/` — imported, verified informal proof blueprints
- `blueprint/` — optional LeanBlueprint/TeX source
- `bin/` — setup, orchestration, build, and verification wrappers
- `archon-protected.yaml` — Lean declarations agents may not weaken or rename
- `.proof-workflow/` — local requests and run state; ignored by Git
- `.archon/` — local Archon state and credentials; ignored by Git

## Pinned versions and updates

The current bridge pins Archon, Rethlas, Lean, and Mathlib versions to keep the
workflow reproducible. Reinstalling a different Archon revision without
reapplying the overlay will remove Proof Studio. See [BRIDGE.md](BRIDGE.md) for
the exact revisions, local safety changes, and update caveats.

## Upstream projects

- [Archon](https://github.com/frenzymath/Archon)
- [Rethlas](https://github.com/frenzymath/Rethlas)
- [Lean 4](https://github.com/leanprover/lean4)
- [Mathlib](https://github.com/leanprover-community/mathlib4)
