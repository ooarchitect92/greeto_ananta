#!/usr/bin/env python3
"""Check the scoped frontend draft boundary without installing or starting services.

Run from any directory. Uses the existing Node executable and original core
contract suite plus the new draft tests. Does not replace the full frontend,
Playwright, security, or release gates. Writes failure-first local evidence only.
"""
from __future__ import annotations
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / 'front end'
OUT = ROOT / '.local-build' / 'frontend-drafts'


def run(name: str, arguments: list[str], timeout: int = 45) -> str:
    """Run a fixed argument vector, retain output, and reject nonzero/timeout results."""
    result = subprocess.run(arguments, cwd=FRONTEND, capture_output=True, text=True,
                            timeout=timeout, check=False)
    (OUT / f'{name}.txt').write_text(result.stdout + result.stderr, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(f'{name} failed; see local evidence')
    return result.stdout


def main() -> int:
    """Emit source hashes and scoped counts, never an inferred publication or deployment."""
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'increment': 'INC-015', 'passed': False, 'production_verified': False,
              'publication': 'not_determined_by_tests'}
    destination = OUT / 'summary.json'
    destination.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    try:
        report['node'] = run('node-version', ['node', '--version']).strip()
        for name in ['src/shared/state/drafts.js', 'tests/drafts-boundary.test.mjs']:
            run(Path(name).stem + '-syntax', ['node', '--check', name])
        output = run('tests', ['node', '--test', 'tests/contracts.test.mjs', 'tests/drafts-boundary.test.mjs'])
        counts = {name: int(value) for name, value in re.findall(r'^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$', output, re.M)}
        if not counts.get('tests') or counts.get('pass') != counts['tests'] or any(counts.get(name, 1) for name in ['fail','cancelled','skipped','todo']):
            raise RuntimeError('Incomplete or non-passing test report')
        report.update(passed=True, tests=counts,
                      scope='Node core contracts and synthetic session-storage boundaries only; not React/browser or server integration',
                      sources=[{'path': name, 'sha256': hashlib.sha256((ROOT / name).read_bytes()).hexdigest()}
                               for name in ['front end/src/shared/state/drafts.js', 'front end/tests/drafts-boundary.test.mjs']])
    except (OSError, RuntimeError, ValueError, subprocess.TimeoutExpired) as error:
        report['failure'] = type(error).__name__
    destination.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
