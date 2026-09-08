#!/usr/bin/env python3
"""Bounded local INC-013 HTTP acknowledgement checks. No install or deployment.

Runs only the receiverhttp package against real local HTTP/TLS and synthetic
host ports. A passing test report is not database, provider or production evidence.
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
OUT = ROOT / ".local-build" / "receiver-http"
PACKAGE = "./services/webhook-dispatcher/receiverhttp"


def run(name: str, args: list[str], timeout: int = 90) -> str:
    """Run a fixed vector with bounded time, preserving output as local evidence."""
    result = subprocess.run(args, cwd=BACKEND, capture_output=True, text=True,
                            env=dict(os.environ, GOTOOLCHAIN="local"), timeout=timeout,
                            check=False)
    (OUT / f"{name}.txt").write_text(result.stdout + result.stderr, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(f"{name} failed")
    return result.stdout


def main() -> int:
    """Write failure-first results, then run tests/vet/format and hash exact sources."""
    OUT.mkdir(parents=True, exist_ok=True)
    report: dict = {"increment": "INC-013", "passed": False, "production_verified": False,
                    "publication": "not_determined_by_tests"}
    target = OUT / "summary.json"
    target.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    try:
        sources = sorted((BACKEND / "services/webhook-dispatcher/receiverhttp").glob("*.go"))
        if not sources:
            raise RuntimeError("receiver sources missing")
        report["go"] = run("version", ["go", "version"], 10).strip()
        if run("format", ["gofmt", "-l", *map(str, sources)], 10).strip():
            raise RuntimeError("formatting required")
        coverage = OUT / "coverage.out"
        raw = run("tests", ["go", "test", "-race", "-count=1", "-timeout=30s", "-json",
                             f"-coverprofile={coverage}", PACKAGE])
        events = [json.loads(line) for line in raw.splitlines() if line.strip()]
        if any(event.get("Action") in {"fail", "skip"} for event in events):
            raise RuntimeError("test failure or skip")
        tests = [event["Test"] for event in events if event.get("Action") == "pass"
                 and event.get("Test", "").startswith("Test")]
        leaf = [test for test in tests if not any(other.startswith(test + "/") for other in tests)]
        if not leaf:
            raise RuntimeError("no named tests executed")
        run("vet", ["go", "vet", PACKAGE])
        total = run("coverage", ["go", "tool", "cover", f"-func={coverage}"], 20)
        match = re.search(r"total:.*?([\d.]+%)", total)
        if match is None:
            raise RuntimeError("coverage unavailable")
        report.update(passed=True, named_tests=len(leaf), failed=0, skipped=0,
                      go_race="passed", go_vet="passed", formatting="passed",
                      coverage=match.group(1),
                      real_wire_cases=[name for name in leaf if name.startswith("TestTLS")
                                       or name in {"TestSlowBodyHasNoSuccess", "TestChunkedAndIdentityEncoding"}],
                      scope="Local HTTP/TLS and real signature composition with test-only Keys/Gate/Inbox; no durable database")
        report["sources"] = [{"path": str(p.relative_to(ROOT)),
                              "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in sources]
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
        report["failure"] = type(error).__name__
    target.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
