# Archon overlay

These files extend the pinned Archon 0.3.3 dashboard with Proof Studio: a
confirmation-gated Codex → Rethlas → Archon → Lean workflow.

`bin/setup` installs Archon at the revision recorded there, copies this overlay
onto the installed package, and rebuilds its client and server. Keeping the
overlay in the repository makes the dashboard changes reproducible while
retaining upstream Archon as a pinned dependency.

`apply_python_compat.py` also makes the pinned initializer skip Claude plugin
registration when the project is configured for Codex and Claude Code is not
installed.
