"""Apply the small Codex-only compatibility patch to the pinned Archon package."""

from __future__ import annotations

import sys
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if text.count(old) != 1:
        raise RuntimeError(f"Archon compatibility anchor changed: {label}")
    return text.replace(old, new, 1)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: apply_python_compat.py ARCHON_PACKAGE_DIR")

    archon_package = Path(sys.argv[1]).resolve()
    skills_path = archon_package / "commands" / "init" / "steps" / "skills.py"
    text = skills_path.read_text()

    text = replace_once(
        text,
        "from ..utils import copy_file, data_path, read_json, run, get_claude_config_dir",
        "from ..utils import copy_file, data_path, read_json, run, get_claude_config_dir, has",
        "skills utils import",
    )
    text = replace_once(
        text,
        """        self._register_marketplace(claude_dir, skills_dir)
        self._install_plugin(claude_dir)
        self._copy_archon_tools()
""",
        """        if has("claude"):
            self._register_marketplace(claude_dir, skills_dir)
            self._install_plugin(claude_dir)
        else:
            log.warn("Claude Code is unavailable; skipping Claude plugin registration")
        self._copy_archon_tools()
""",
        "Codex-only skills initialization",
    )

    skills_path.write_text(text)


if __name__ == "__main__":
    main()
