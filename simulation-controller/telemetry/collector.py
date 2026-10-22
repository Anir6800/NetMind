"""Bounded host telemetry probes. Missing probe values are represented as None."""
from __future__ import annotations

import json
import re
import subprocess
import time
from collections.abc import Callable

Runner = Callable[[list[str], float], str]


def run_command(args: list[str], timeout: float) -> str:
    return subprocess.run(args, capture_output=True, check=True, text=True, timeout=timeout, shell=False).stdout


class Collector:
    def __init__(self, source: str, runner: Runner = run_command, timeout_s: float = 3) -> None:
        if source not in {"MEASURED", "SIMULATED"}:
            raise ValueError("telemetry source must be MEASURED or SIMULATED")
        self.source, self.runner, self.timeout_s = source, runner, timeout_s

    def collect(self, target: str, interface: str, iperf_target: str | None = None) -> dict:
        sample = {"wall_time": time.time(), "monotonic_time": time.monotonic(), "source": self.source, "rtt_ms": None, "loss_pct": None, "jitter_ms": None, "throughput_mbps": None, "rx_errors": None, "rx_dropped": None, "tx_errors": None, "tx_dropped": None}
        sample.update(self._ping(target))
        sample.update(self._interface(interface))
        if iperf_target:
            sample.update(self._iperf(iperf_target))
        return sample

    def _probe(self, args: list[str]) -> str | None:
        try:
            return self.runner(args, self.timeout_s)
        except (OSError, subprocess.SubprocessError, TimeoutError):
            return None

    def _ping(self, target: str) -> dict:
        output = self._probe(["ping", "-c", "4", "-W", str(int(self.timeout_s)), target])
        if not output:
            return {"rtt_ms": None, "loss_pct": None, "jitter_ms": None}
        loss = re.search(r"(\d+(?:\.\d+)?)% packet loss", output)
        rtt = re.search(r"= [\d.]+/([\d.]+)/[\d.]+/([\d.]+) ms", output)
        return {"rtt_ms": float(rtt.group(1)) if rtt else None, "loss_pct": float(loss.group(1)) if loss else None, "jitter_ms": float(rtt.group(2)) if rtt else None}

    def _iperf(self, target: str) -> dict:
        output = self._probe(["iperf3", "--json", "--time", "1", "--client", target])
        try:
            bits = json.loads(output or "{}")["end"]["sum_received"]["bits_per_second"]
            return {"throughput_mbps": bits / 1_000_000}
        except (KeyError, TypeError, ValueError):
            return {"throughput_mbps": None}

    def _interface(self, interface: str) -> dict:
        output = self._probe(["ip", "-s", "link", "show", "dev", interface])
        values = re.findall(r"RX:.*?\n\s*\d+\s+\d+\s+(\d+)\s+(\d+).*?TX:.*?\n\s*\d+\s+\d+\s+(\d+)\s+(\d+)", output or "", re.DOTALL)
        if not values:
            return {"rx_errors": None, "rx_dropped": None, "tx_errors": None, "tx_dropped": None}
        rx_errors, rx_dropped, tx_errors, tx_dropped = values[0]
        return {"rx_errors": int(rx_errors), "rx_dropped": int(rx_dropped), "tx_errors": int(tx_errors), "tx_dropped": int(tx_dropped)}
