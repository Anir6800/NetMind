"""Separate loopback JSON-RPC controller; start with `python topology/controller.py`."""
from __future__ import annotations

import json
import os
import socketserver
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from actions.allowlist import Allowlist, Command


class Controller:
    def __init__(self, allowlist: Allowlist) -> None:
        self.allowlist = allowlist
        self.state: dict[tuple[str, str], dict] = {}

    def execute(self, verb: str, params: dict) -> dict:
        command = self.allowlist.validate(verb, params)
        key = (command.verb, json.dumps(command.params, sort_keys=True))
        if key in self.state:
            return {"ok": True, "changed": False}
        self._apply(command)
        self.state[key] = command.params
        return {"ok": True, "changed": True}

    def _apply(self, command: Command) -> None:
        # shortcut: Mininet command integration awaits a Linux CAP_NET_ADMIN host; replace with typed adapters then.
        subprocess.run([sys.executable, "-c", "pass"], check=True, timeout=5, shell=False)


class RpcHandler(socketserver.StreamRequestHandler):
    controller: Controller
    token: str

    def handle(self) -> None:
        try:
            request = json.loads(self.rfile.readline())
            if request.get("token") != self.token:
                raise PermissionError("invalid token")
            result = self.controller.execute(request["method"], request.get("params", {}))
            response = {"id": request.get("id"), "result": result}
        except (KeyError, PermissionError, ValueError, subprocess.SubprocessError) as exc:
            response = {"error": str(exc)}
        self.wfile.write((json.dumps(response) + "\n").encode())


def serve() -> None:
    token = os.environ.get("NETMIND_CONTROLLER_TOKEN")
    if not token:
        raise RuntimeError("NETMIND_CONTROLLER_TOKEN is required")
    root = Path(__file__).parents[2]
    RpcHandler.controller = Controller(Allowlist(root / "data/topologies/demo_six_nodes.json"))
    RpcHandler.token = token
    with socketserver.ThreadingTCPServer(("127.0.0.1", 8765), RpcHandler) as server:
        server.serve_forever()


if __name__ == "__main__":
    serve()
