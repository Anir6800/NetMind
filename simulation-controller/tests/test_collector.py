import sys
from pathlib import Path

ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "simulation-controller"))

from telemetry.collector import Collector

PING = "4 packets transmitted, 4 received, 0% packet loss\nrtt min/avg/max/mdev = 1.0/2.0/3.0/0.5 ms"
IP = "RX: bytes packets errors dropped\n 100 2 3 4\nTX: bytes packets errors dropped\n 200 5 6 7"
IPERF = '{"end": {"sum_received": {"bits_per_second": 2500000}}}'


def test_collector_parses_bounded_fixtures() -> None:
    def runner(args: list[str], timeout: float) -> str:
        assert timeout == 3
        return PING if args[0] == "ping" else IP if args[0] == "ip" else IPERF

    sample = Collector("SIMULATED", runner).collect("host-b", "eth0", "host-b")
    assert sample["source"] == "SIMULATED"
    assert sample["rtt_ms"] == 2
    assert sample["jitter_ms"] == 0.5
    assert sample["throughput_mbps"] == 2.5
    assert sample["rx_dropped"] == 4


def test_collector_timeout_keeps_missing_values_unknown() -> None:
    def timeout_runner(args: list[str], timeout: float) -> str:
        raise TimeoutError

    sample = Collector("MEASURED", timeout_runner).collect("host-b", "eth0", "host-b")
    assert sample["rtt_ms"] is None
    assert sample["throughput_mbps"] is None
    assert sample["rx_errors"] is None
