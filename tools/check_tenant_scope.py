#!/usr/bin/env python3
"""Compile/test incremental scope sources using the existing tsc + Node tools.

No install, network, migration, deployment or Git write. Does not replace the
existing check_foundation.py gates. All SQL/auth test ports are synthetic.
"""
from pathlib import Path
import json
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.local-build' / 'tenant-scope'


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    """Run a bounded local validation command; fail loudly without altering gates."""
    result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=90)
    print(result.stdout, end='')
    if result.returncode:
        print(result.stderr, file=sys.stderr, end='')
        raise SystemExit(result.returncode)
    return result


def main() -> None:
    """Write a truthful local-only report only after compilation and both suites pass."""
    for tool in ('node', 'tsc'):
        if shutil.which(tool) is None:
            raise SystemExit(f'{tool} is required; this runner never installs or changes dependencies.')
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'package.json').write_text('{"type":"module"}\n', encoding='utf-8')
    source = ROOT / 'backend/services/core/src/platform'
    run(['tsc','--strict','--noUncheckedIndexedAccess','--exactOptionalPropertyTypes',
         '--noEmitOnError','--target','ES2022','--lib','ES2022,DOM','--module','ES2022',
         '--moduleResolution','bundler','--outDir',str(OUT),
         str(source/'tenant-scope.ts'),str(source/'postgres-scope-reader.ts')])
    backend = run(['node','--test','backend/services/core/test/tenant-scope.test.mjs'])
    frontend = run(['node','--test','front end/tests/tenant-scope-model.test.mjs'])
    report = {'increment':'INC-003','publication':'not_determined_by_test_runner', 'typecheck':'passed',
              'test_scope':'Scripted adapter contract/unit tests, not live PostgreSQL/OIDC/RLS.',
              'backend_tap':backend.stdout,'frontend_tap':frontend.stdout,
              'existing_foundation_regression':'not_run_by_this_runner',
              'live_integrations':'not_tested','production_deployment':'not_performed'}
    (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print('Local scope checks passed. No production gate or GitHub publication is certified.')


if __name__ == '__main__':
    main()
