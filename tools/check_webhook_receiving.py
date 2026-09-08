#!/usr/bin/env python3
"""Run the bounded, dependency-free INC-011 receiver checks from any directory.

No install, Git write, infrastructure creation or runtime route registration occurs.
Reports describe local code tests only; they cannot certify cloud/receiver durability.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
OUT = ROOT / ".local-build" / "webhook-receiving"
PACKAGE = "./services/webhook-dispatcher/receiving"


def run(name: str, args: list[str], timeout: int = 90) -> str:
    """Run a fixed argument vector, capture evidence, and fail on timeout/nonzero exit."""
    env = dict(os.environ, GOTOOLCHAIN="local")
    result = subprocess.run(args, cwd=BACKEND, env=env, capture_output=True,
                            text=True, timeout=timeout, check=False)
    (OUT / f"{name}.txt").write_text(result.stdout + result.stderr, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(f"{name} failed; inspect the local evidence file")
    return result.stdout


def main() -> int:
    """Write a fresh failure-first report, then compile/test/vet and record source hashes."""
    OUT.mkdir(parents=True, exist_ok=True)
    report: dict = {"increment": "INC-011", "passed": False,
                    "production_verified": False, "publication": "not_determined_by_tests"}
    path = OUT / "summary.json"
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    try:
        report["go"] = run("go-version", ["go", "version"], 10).strip()
        files = sorted((BACKEND / "services/webhook-dispatcher/receiving").glob("*.go"))
        if not files:
            raise RuntimeError("receiver sources are missing")
        if run("format", ["gofmt", "-l", *map(str, files)], 10).strip():
            raise RuntimeError("gofmt changes are required")
        coverage = OUT / "coverage.out"
        output = run("go-tests", ["go", "test", "-race", "-count=1", "-json",
                                  f"-coverprofile={coverage}", PACKAGE])
        events = [json.loads(line) for line in output.splitlines() if line.strip()]
        if any(event.get("Action") in {"fail", "skip"} for event in events):
            raise RuntimeError("a test failed or was skipped")
        passed = [event["Test"] for event in events if event.get("Action") == "pass"
                  and event.get("Test", "").startswith("Test")]
        leaf = [name for name in passed if not any(other.startswith(name + "/") for other in passed)]
        if not leaf:
            raise RuntimeError("no named tests ran")
        run("vet", ["go", "vet", PACKAGE, "./services/webhook-dispatcher/signing"])
        cover = run("coverage", ["go", "tool", "cover", f"-func={coverage}"], 20)
        match = re.search(r"total:.*?([\d.]+%)", cover)
        if match is None:
            raise RuntimeError("coverage total is missing")
        report.update(passed=True, named_leaf_tests=len(leaf), failed=0, skipped=0,
                      race="passed", vet="passed", formatting="passed", coverage=match.group(1),
                      fuzz_seed_tests=sum(e.get("Action") == "pass" and
                                          e.get("Test", "").startswith("FuzzEventIdentity/seed#")
                                          for e in events),
                      scope="Local Go cryptographic/parser/immutability checks; no replay store or HTTP host",
                      files=[{"path": str(f.relative_to(ROOT)),
                              "sha256": hashlib.sha256(f.read_bytes()).hexdigest()} for f in files])
    except (OSError, RuntimeError, subprocess.TimeoutExpired, ValueError) as exc:
        report["failure"] = type(exc).__name__
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
