"""Apply TheoremProver compatibility patches to the pinned Archon package."""

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

    port_path = archon_package / "commands" / "dashboard" / "port.py"
    text = port_path.read_text()
    text = replace_once(
        text,
        "import json\nimport socket",
        "import json\nimport os\nimport socket",
        "dashboard port os import",
    )
    text = replace_once(
        text,
        '''    try:\n        s = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)''',
        '''    # TheoremProver deliberately binds the dashboard to loopback.  If\n    # the launcher supplies an explicit host, probe that exact address rather\n    # than the broader IPv6/IPv4 wildcard.  A VPN or a service bound only on\n    # another interface must not make 127.0.0.1 look occupied.\n    configured_host = os.environ.get("ARCHON_DASHBOARD_HOST")\n    if configured_host:\n        family = socket.AF_INET6 if ":" in configured_host else socket.AF_INET\n        address = (configured_host, port, 0, 0) if family == socket.AF_INET6 else (configured_host, port)\n        try:\n            s = socket.socket(family, socket.SOCK_STREAM)\n            try:\n                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)\n                s.bind(address)\n                return False\n            finally:\n                s.close()\n        except OSError:\n            return True\n\n    try:\n        s = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)''',
        "dashboard configured-host port probe",
    )
    port_path.write_text(text)

    server_path = archon_package / "commands" / "dashboard" / "server.py"
    text = server_path.read_text()
    text = replace_once(
        text,
        '''        if died:\n            log.warn(\n                f"Port {port} was taken (likely by a parallel dashboard). "\n                "Trying the next port…",\n            )''',
        '''        if died:\n            exit_code = self.proc.poll() if self.proc is not None else None\n            log.warn(\n                f"Dashboard process exited with status {exit_code} before its "\n                f"health check on port {port}. The preceding error is the cause; "\n                "trying the next port…",\n            )''',
        "truthful dashboard early-exit diagnostic",
    )
    server_path.write_text(text)


if __name__ == "__main__":
    main()
