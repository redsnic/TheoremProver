# Proof Studio

Proof Studio is the local intake and orchestration page added to the Archon
dashboard. Start it with:

```bash
./bin/archon dashboard . --open
```

Open **New Proof** in the top navigation. The server listens on loopback only by
default; job state and logs stay under `.proof-workflow/` and are not committed.

## Workflow

1. Enter a title, stable lowercase slug, iteration budget, and Markdown problem.
2. Select **Review request**. The confirmation dialog shows the exact Markdown,
   SHA-256 hash, and iteration budget.
3. Select **Confirm, lock & run**. The immutable request is stored read-only and
   copied into Rethlas. Rethlas generates and independently verifies a proof
   blueprint, then the bridge imports it into `references/`.
4. Codex proposes only a Lean theorem signature under a read-only sandbox. The
   bridge compile-checks it with Mathlib before showing it.
5. Review the plain-English interpretation, assumptions, syntax-highlighted
   Lean code, and target file. Choose **Decline & regenerate** with feedback or
   **Confirm, protect & prove**.
6. A confirmed statement is added to `archon-protected.yaml`, registered as the
   current objective, and handed to the bounded Archon plan/prove/review loop.
7. `./bin/doctor` runs after Archon. The job becomes **Lean verified** only when
   the project builds without `sorry` placeholders or unexpected axioms.

## Progress and controls

The page highlights the current job in a large five-step timeline. When a job is
running or needs input, every dashboard page also shows an amber banner linking
back to Proof Studio.

- **Stop** sends `SIGTERM` to the active local process group and records the job
  as cancelled.
- **Retry checkpoint** resumes from the latest safe artifact: the imported
  blueprint or the existing Lean objective.
- **View request** shows the immutable original Markdown and run metadata.
- **Edit & rerun** copies a historical request into the editor under a new,
  collision-free slug; the original run remains unchanged.
- **Explain proof** appears after Rethlas has produced a verified blueprint. It
  uses Codex on demand to expand the mathematical proof into small numbered
  steps, optionally emphasizing a topic supplied by the user. The explanation
  is saved as `blueprint-explanation.md` in that job's private workflow folder
  and can be viewed or regenerated later. It never changes the blueprint,
  confirmed theorem, or Lean source.
- **Technical log** exposes the exact wrapper and agent output without making it
  the primary interface.
- Only one confirmed workflow may occupy the expensive pipeline at a time.

## Safety boundaries

- Mutating endpoints enforce same-origin requests and accept validated IDs and
  slugs, never arbitrary command lines or paths.
- The original request is hashed before agents run and checked again after
  Rethlas completes.
- The Lean proposal is hashed, compile-checked, and confirmed before a source
  file is created.
- The confirmed declaration signature is protected; Archon may fill its proof
  body but may not weaken or rename the theorem.
- The page is not designed for direct public exposure. Remote use requires an
  authenticated, HTTPS reverse proxy plus normal network hardening.
