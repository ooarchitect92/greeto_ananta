#!/usr/bin/env python3
"""Run INC-007 cryptographic conformance checks, not production qualification.

Parameters: none; resolves repository root relative to this file. Uses installed
Go/Node/TypeScript, does not install or upgrade dependencies. Writes local evidence
under .local-build/webhook-signing. No API, provider, DB, Git or deployment writes.
Fails on any missing tool, failed test or type check; never silently skips a gate.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.local-build' / 'webhook-signing'


def run(name: str, command: list[str], cwd: Path) -> str:
    """Execute a bounded local check and retain stdout/stderr before failing.

    name: fixed report stem, command: explicit argv (never shell input), cwd:
    repository-owned directory. Returns stdout only for a successful exit.
    A timeout or nonzero exit stops the runner; credentials are never supplied.
    """
    result = subprocess.run(command, cwd=cwd, env={**os.environ, 'GOTOOLCHAIN': 'local'},
                            text=True, capture_output=True, timeout=240, check=False)
    (OUT / (name + '.stdout')).write_text(result.stdout, encoding='utf-8')
    (OUT / (name + '.stderr')).write_text(result.stderr, encoding='utf-8')
    if result.returncode:
        raise SystemExit(f'{name} failed; inspect {OUT}')
    return result.stdout


def main() -> None:
    """Run all targeted gates; report actual counts without marking a parent Done."""
    for tool in ('go', 'node', 'tsc'):
        if shutil.which(tool) is None:
            raise SystemExit(f'Required installed tool missing: {tool}')
    OUT.mkdir(parents=True, exist_ok=True)
    stream = run('go-tests', ['go', 'test', '-race', '-count=1', '-json',
                              './services/webhook-dispatcher/signing'], ROOT / 'backend')
    records = [json.loads(line) for line in stream.splitlines() if line.strip()]
    passed = {r['Test'] for r in records if r.get('Action') == 'pass' and r.get('Test')}
    leaves = [name for name in passed if not any(other.startswith(name + '/') for other in passed)]
    if not leaves or any(r.get('Action') in ('fail', 'skip') for r in records):
        raise SystemExit('Go checks did not complete without failures/skips')
    run('go-vet', ['go', 'vet', './services/webhook-dispatcher/signing'], ROOT / 'backend')
    tap = run('node-tests', ['node', '--test', '--test-reporter=tap',
                            'backend/sdk/typescript/webhook-signature.test.mjs'], ROOT)
    counts = {key: int(value) for key, value in re.findall(r'^# (tests|fail|skipped|cancelled) (\d+)$', tap, re.M)}
    if not counts.get('tests') or any(counts.get(k, -1) != 0 for k in ('fail', 'skipped', 'cancelled')):
        raise SystemExit('Node checks did not complete without failures/skips')
    run('typescript', ['tsc', '--strict', '--noEmit', '--module', 'NodeNext',
                       '--moduleResolution', 'NodeNext', '--target', 'ES2022',
                       'backend/sdk/typescript/webhook-signature.types.mts'], ROOT)
    run('python-tests', [sys.executable, '-m', 'unittest', 'discover', '-s',
                         'backend/sdk/python', '-p', 'test_*.py', '-v'], ROOT)
    py_summary = (OUT / 'python-tests.stderr').read_text(encoding='utf-8')
    py_count = re.search(r'Ran (\d+) tests?', py_summary)
    if py_count is None or '\nOK\n' not in py_summary or 'skipped=' in py_summary:
        raise SystemExit('Python tests did not complete without skips')
    report = {'increment': 'INC-007', 'go_leaf_tests': len(leaves), 'node_tests': counts['tests'],
              'python_tests': int(py_count.group(1)),
              'total': len(leaves) + counts['tests'] + int(py_count.group(1)), 'failed': 0, 'skipped': 0, 'cancelled': 0,
              'go_race': 'passed', 'go_vet': 'passed', 'typescript_consumer': 'passed',
              'shared_independent_vectors': 6,
              'scope': 'Real stdlib HMAC conformance, not a running delivery/receiver service or replay ledger.',
              'not_run': ['full repository regression', 'React build/browser', 'KMS/DB/Kafka/HTTPS delivery',
                          'durable receiver ledger', 'production or provider qualification']}
    (OUT / 'report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
