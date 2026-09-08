#!/usr/bin/env python3
"""Validate INC-016's pure Meta configuration preparation; never installs or deploys.

Requires an existing Node and TypeScript compiler. This scoped runner compiles only
new control-plane code, checks its typed consumer and runs its producer/presentation
fixtures. It is not a full React build, provider test, API host or release workflow.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.local-build/meta-signup'
SOURCE = 'backend/services/core/src/channels/meta/signup-configuration.ts'
TEST = 'backend/services/core/tests/meta-signup-configuration.test.mjs'
FRONT = 'front end/tests/meta-signup-setup.test.mjs'


def run(label: str, command: list[str]) -> str:
    """Fixed argument vectors, bounded time, captured logs; nonzero always fails."""
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=60, check=False)
    (OUT / (label + '.txt')).write_text(result.stdout + result.stderr, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(label)
    return result.stdout


def main() -> int:
    """Write failure-first evidence, run only local checks, record exact source hashes."""
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'increment': 'INC-016', 'passed': False, 'production_verified': False,
              'publication': 'not_determined_by_tests'}
    output = OUT / 'summary.json'
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    try:
        node, tsc = shutil.which('node'), shutil.which('tsc')
        if not node or not tsc:
            raise RuntimeError('Existing Node and TypeScript compiler are required; no installation attempted')
        report['node'] = run('node-version', [node, '--version']).strip()
        report['typescript'] = run('tsc-version', [tsc, '--version']).strip()
        args = ['--strict', '--target', 'ES2022', '--module', 'commonjs', '--lib', 'ES2022,DOM']
        run('compile', [tsc, *args, '--outDir', str(OUT), SOURCE])
        run('types', [tsc, *args, '--noEmit', 'backend/services/core/tests/meta-signup-configuration.types.ts'])
        text = run('tests', [node, '--test', TEST, FRONT])
        totals = {key: int(value) for key, value in re.findall(r'^# (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$', text, re.M)}
        if not totals.get('tests') or totals.get('pass') != totals['tests'] or any(totals.get(k, 1) for k in ['fail','skipped','cancelled','todo']):
            raise RuntimeError('Missing or non-passing test summary')
        report.update(passed=True, tests=totals, strict_types='passed',
                      scope='Pure producer and synthetic profile/presentation tests; no OAuth, provider, DB or browser')
        files = [SOURCE, TEST, FRONT, 'front end/src/features/channels/meta/signup-setup-model.mjs',
                 'front end/src/features/channels/meta/MetaSignupSetupPanel.jsx',
                 'front end/src/features/studio/FeatureStudioPage.jsx']
        report['source_hashes'] = {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in files}
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as exc:
        report['failure'] = type(exc).__name__
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
    return 0 if report['passed'] else 1

if __name__ == '__main__':
    sys.exit(main())
