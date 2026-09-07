#!/usr/bin/env python3
"""Compile and test the SQL delivery adapter without installing or migrating anything.

Uses the existing Node/TypeScript toolchain. This is an additive local check, not
replacement CI or production acceptance. Scripted SQL is not live PostgreSQL.
"""
from pathlib import Path
import json
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.local-build' / 'status-store'


def run(command: list[str]) -> str:
    """Run one bounded validation; preserve failures and never relax a check."""
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=90)
    print(result.stdout, end='')
    if result.returncode:
        print(result.stderr, file=sys.stderr, end='')
        raise SystemExit(result.returncode)
    return result.stdout


def main() -> None:
    """Write local test evidence only; no credentials, network or database setup."""
    for executable in ('node', 'tsc'):
        if not shutil.which(executable):
            raise SystemExit(f'{executable} is required; this runner never installs dependencies.')
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'package.json').write_text('{"type":"module"}\n', encoding='utf-8')
    source = ROOT / 'backend/services/core/src'
    run(['tsc', '--strict', '--noUncheckedIndexedAccess', '--exactOptionalPropertyTypes',
         '--noEmitOnError', '--target', 'ES2022', '--lib', 'ES2022,DOM', '--module', 'ES2022',
         '--moduleResolution', 'bundler', '--outDir', str(OUT),
         *[str(source / p) for p in ['status-service.ts', 'platform/tenant-scope.ts',
             'platform/postgres-scope-reader.ts', 'delivery/postgres-status-repository.ts']]])
    tap = run(['node', '--test', 'backend/services/core/test/postgres-status-repository.test.mjs'])
    (OUT / 'report.json').write_text(json.dumps({
        'increment':'INC-005', 'typecheck':'passed', 'tap':tap,
        'test_scope':'unchanged StatusService + new adapter + scripted SQL protocol',
        'live_postgresql':'not_tested', 'production_deployment':'not_performed',
        'publication':'not_determined_by_test_runner'}, indent=2)+'\n', encoding='utf-8')
    print('Status-store checks passed locally; no production or remote publication gate is certified.')


if __name__ == '__main__':
    main()
