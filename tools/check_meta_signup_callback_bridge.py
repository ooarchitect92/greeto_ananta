#!/usr/bin/env python3
"""Run INC-018 callback-parser, bridge and projection checks, without installations.

This runner does not start React, a browser, Meta, a database, an HTTP listener or
GitHub Actions. TypeScript checks the consumer declarations; the implementation is
JavaScript, checked by Node syntax/unit tests, not a strict TypeScript source build.
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
OUT = ROOT / '.local-build' / 'meta-signup-callback-bridge'
FRONT = ROOT / 'front end'
MODULES = FRONT / 'src/features/channels/meta'


def command(label: str, args: list[str], timeout: int = 45) -> str:
    """Execute fixed arguments, save output, fail on nonzero or bounded timeout."""
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True, timeout=timeout, check=False)
    (OUT / f'{label}.txt').write_text(result.stdout + result.stderr, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(f'{label} failed; see local evidence')
    return result.stdout


def main() -> int:
    """Write failure-first evidence, run named tests and declaration/JSX checks."""
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'increment': 'INC-018', 'passed': False, 'runtime_connected': False,
              'publication': 'not_determined_by_tests'}
    destination = OUT / 'summary.json'
    destination.write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    try:
        report['node'] = command('node', ['node', '--version'], 10).strip()
        compiler = shutil.which('tsc')
        if not compiler:
            raise RuntimeError('Existing TypeScript compiler required; no install attempted')
        report['typescript'] = command('typescript', [compiler, '--version'], 10).strip()
        tests = [FRONT / 'tests' / f'meta-signup-callback-{name}.test.mjs' for name in ['parser','bridge','view']]
        tests.append(FRONT / 'tests/meta-signup-attempt.test.mjs')
        output = command('tests', ['node','--test','--test-reporter=tap',*map(str, tests)])
        counts = {}
        for key in ['tests','pass','fail','cancelled','skipped','todo']:
            match = re.search(rf'^# {key} (\d+)$', output, re.M)
            if not match:
                raise RuntimeError('Incomplete test evidence')
            counts[key] = int(match.group(1))
        if counts['pass'] != counts['tests'] or any(counts[k] for k in ['fail','cancelled','skipped','todo']):
            raise RuntimeError('Not all targeted tests passed')
        sources = [MODULES / f'signup-callback-{name}.mjs' for name in ['parser','bridge','view']]
        for i, source in enumerate(sources):
            command(f'syntax-{i}', ['node','--check',str(source)], 10)
        command('consumer-types', [compiler,'--noEmit','--strict','--target','ES2022','--module','NodeNext',
                  '--moduleResolution','NodeNext',str(FRONT/'tests/meta-signup-callback-bridge.types.mts')])
        # Resolve the already installed compiler for parse-only JSX diagnostics.
        ts_module = Path(compiler).resolve().parent.parent / 'lib/typescript.js'
        if not ts_module.is_file():
            candidate = os.environ.get('GREETO_TYPESCRIPT_MODULE')
            if not candidate or not Path(candidate).is_file():
                raise RuntimeError('Set GREETO_TYPESCRIPT_MODULE to existing typescript.js')
            ts_module = Path(candidate)
        script = "const fs=require('fs'),ts=require(process.argv[1]);const f=process.argv[2];const p=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);if(p.parseDiagnostics.length)process.exit(1);console.log('1 JSX file parsed; not rendered');"
        command('jsx', ['node','-e',script,str(ts_module),str(MODULES/'MetaSignupSetupPanel.jsx')], 15)
        report.update(passed=True, tests=counts, js_syntax_files=3, jsx_syntax_files=1,
          typescript_consumer='passed; declarations only',
          source_hashes={str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sources},
          scope='Synthetic native-message/source/transport fixtures and real WebCrypto; no live SDK/HTTP/server/DB/browser acceptance')
    except (OSError, RuntimeError, subprocess.TimeoutExpired, ValueError) as exc:
        report['failure'] = str(exc)
    destination.write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    sys.exit(main())
