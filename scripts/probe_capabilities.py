#!/usr/bin/env python3
"""Emit the local NetMind capability matrix and selected runtime mode."""
import json
import os
import platform
import shutil
import subprocess
import ctypes
from pathlib import Path


def command(name):
    path = shutil.which(name)
    if not path:
        return {"available": False, "path": None, "version": None}
    try:
        result = subprocess.run([name, "--version"], capture_output=True, text=True, timeout=2)
        version = (result.stdout or result.stderr).splitlines()[0] if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        version = None
    return {"available": True, "path": path, "version": version}


def linux_privileges():
    linux = platform.system() == "Linux"
    uid = os.geteuid() if hasattr(os, "geteuid") else None
    cap_net_admin = False
    if linux:
        status = Path("/proc/self/status")
        if status.exists():
            caps = next((line.split(":", 1)[1].strip() for line in status.read_text().splitlines() if line.startswith("CapEff:")), "0")
            cap_net_admin = bool(int(caps, 16) & (1 << 12))
    return {"uid": uid, "root": uid == 0, "cap_net_admin": cap_net_admin}


def ram_bytes():
    if platform.system() == "Linux" and Path("/proc/meminfo").exists():
        return int(Path("/proc/meminfo").read_text().split("MemTotal:", 1)[1].split()[0]) * 1024
    if platform.system() == "Windows":
        class Status(ctypes.Structure):
            _fields_ = [("length", ctypes.c_ulong), ("memory_load", ctypes.c_ulong), ("total", ctypes.c_ulonglong), ("available", ctypes.c_ulonglong), ("page_total", ctypes.c_ulonglong), ("page_available", ctypes.c_ulonglong), ("virtual_total", ctypes.c_ulonglong), ("virtual_available", ctypes.c_ulonglong), ("extended", ctypes.c_ulonglong)]
        status = Status(ctypes.sizeof(Status))
        return status.total if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)) else None
    return None


def main():
    linux = platform.system() == "Linux"
    commands = {name: command(name) for name in ("docker", "git", "node", "python3", "firebase", "ip", "tc", "iperf3", "ovs-vsctl", "mn")}
    netns = linux and Path("/proc/self/ns/net").exists() and bool(commands["ip"]["available"])
    ovs = commands["ovs-vsctl"]["available"]
    mininet = linux and commands["mn"]["available"] and commands["ip"]["available"] and commands["tc"]["available"] and commands["iperf3"]["available"] and (linux_privileges()["root"] or linux_privileges()["cap_net_admin"])
    matrix = {
        "os": {"system": platform.system(), "release": platform.release(), "machine": platform.machine(), "linux_or_ubuntu_vm": linux and ("microsoft" in platform.release().lower() or Path("/run/WSL").exists() or Path("/.dockerenv").exists())},
        "ram_bytes": ram_bytes(),
        "privileges": linux_privileges(),
        "network_namespaces": netns,
        "open_vswitch": ovs,
        "commands": commands,
        "selected_mode": "MININET" if mininet else "SIMULATED",
    }
    print(json.dumps(matrix, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
