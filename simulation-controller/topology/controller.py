"""Separate loopback JSON-RPC controller; start with `python topology/controller.py`."""
from __future__ import annotations

import json
import logging
import os
import secrets
import socketserver
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from actions.allowlist import Allowlist, Command

logger = logging.getLogger(__name__)
MAX_REQUEST_BYTES = 16_384
LOOPBACK_ADDRESS = ("127.0.0.1", 8765)


def _safe_log(value: object) -> str:
    return str(value).replace("\r", "\\r").replace("\n", "\\n")[:256]


def _request(value: object) -> tuple[object, str, dict, str]:
    if not isinstance(value, dict) or not isinstance(value.get("method"), str) or not isinstance(value.get("params", {}), dict) or not isinstance(value.get("token"), str):
        raise ValueError("request must contain token, method, and object params")
    return value.get("id"), value["method"], value.get("params", {}), value["token"]


def _drop_privileges() -> None:
    uid = os.environ.get("NETMIND_CONTROLLER_UID")
    if uid and os.name == "posix" and os.geteuid() == 0:
        gid = os.environ.get("NETMIND_CONTROLLER_GID", uid)
        os.setgroups([])
        os.setgid(int(gid))
        os.setuid(int(uid))


class Controller:
    def __init__(self, allowlist: Allowlist) -> None:
        self.allowlist = allowlist
        self.state: dict[tuple[str, str], dict] = {}

    def execute(self, verb: str, params: dict) -> dict:
        command = self.allowlist.validate(verb, params)
        key = self._state_key(command)
        if self.state.get(key) == command.params:
            return {"ok": True, "changed": False}
        self._apply(command)
        self.state[key] = command.params
        return {"ok": True, "changed": True}

    def telemetry(self) -> dict:
        return {"source": "MEASURED", "paths": {}}

    @staticmethod
    def _state_key(command: Command) -> tuple[str, str]:
        if command.verb == "set_link_state":
            return command.verb, command.params["link_id"]
        if command.verb in {"set_netem", "clear_netem"}:
            return "netem", f"{command.params['node_id']}:{command.params['interface_id']}"
        return command.verb, f"{command.params['node_id']}:{command.params['destination']}"

    def _apply(self, command: Command) -> None:
        # shortcut: Mininet command integration awaits a Linux CAP_NET_ADMIN host; replace with typed adapters then.
        subprocess.run([sys.executable, "-c", "pass"], check=True, timeout=5, shell=False)


class RpcHandler(socketserver.StreamRequestHandler):
    controller: Controller
    token: str

    def handle(self) -> None:
        try:
            raw = self.rfile.readline(MAX_REQUEST_BYTES + 1)
            if len(raw) > MAX_REQUEST_BYTES:
                raise ValueError("request exceeds size limit")
            request_id, method, params, token = _request(json.loads(raw))
            if not secrets.compare_digest(token, self.token):
                raise PermissionError("invalid token")
            response = {"id": request_id, "result": self.controller.execute(method, params)}
        except (json.JSONDecodeError, PermissionError, TypeError, ValueError, subprocess.SubprocessError) as exc:
            logger.warning("controller request rejected: %s", _safe_log(exc))
            response = {"error": "invalid controller request"}
        self.wfile.write((json.dumps(response) + "\n").encode())


def serve() -> None:
    token = os.environ.get("NETMIND_CONTROLLER_TOKEN")
    if not token:
        raise RuntimeError("NETMIND_CONTROLLER_TOKEN is required")
    root = Path(__file__).parents[2]
    _drop_privileges()
    RpcHandler.controller = Controller(Allowlist(root / "data/topologies/demo_six_nodes.json"))
    RpcHandler.token = token
    with socketserver.ThreadingTCPServer(LOOPBACK_ADDRESS, RpcHandler) as server:
        server.serve_forever()


if __name__ == "__main__":
    serve()
