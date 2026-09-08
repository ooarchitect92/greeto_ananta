#!/usr/bin/env python3
"""Run the bounded INC-008 tests. No installs, external calls, DB writes or Git writes.

Requires the existing Go/Node/TypeScript executables. Reports real Go TLS over
in-memory sockets plus synthetic DNS/authority ports; never production integration.
This additive runner does not replace the original release or regression gates.
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
OUT = ROOT / '.local-build' / 'webhook-egress'

def run(name: str, args: list[str], cwd: Path = ROOT) -> str:
    """Execute one bounded check, persist actual output, fail on any nonzero exit."""
    p = subprocess.run(args, cwd=cwd, env={**os.environ, 'GOTOOLCHAIN': 'local'},
                       capture_output=True, text=True, timeout=90, check=False)
    text = p.stdout + p.stderr
    (OUT / f'{name}.txt').write_text(text, encoding='utf-8')
    if p.returncode:
        print(text[-6000:], file=sys.stderr)
        raise RuntimeError(f'{name} failed ({p.returncode})')
    return text

def main() -> int:
    """Compile/test existing sources and write a scoped evidence report."""
    OUT.mkdir(parents=True, exist_ok=True)
    report: dict = {'increment': 'INC-008', 'passed': False, 'production_verified': False}
    try:
        for tool in ('go', 'node', 'tsc'):
            if not shutil.which(tool):
                raise RuntimeError(f'Missing prerequisite: {tool}; no automatic installation')
        backend = ROOT / 'backend'
        fmt = run('gofmt', ['gofmt', '-l', 'services/webhook-dispatcher/egress'], backend)
        if fmt.strip():
            raise RuntimeError('Go source is not gofmt-formatted')
        raw = run('go-race', ['go', 'test', '-json', '-race', '-count=1', '-timeout=40s',
                  '-coverprofile=' + str(OUT / 'coverage.out'), './services/webhook-dispatcher/egress'], backend)
        events = [json.loads(line) for line in raw.splitlines() if line.startswith('{')]
        names = {e['Test'] for e in events if e.get('Action') == 'pass' and e.get('Test', '').startswith('Test')}
        leaf = [n for n in names if not any(k.startswith(n + '/') for k in names)]
        run('go-vet', ['go', 'vet', './services/webhook-dispatcher/egress'], backend)
        coverage = run('coverage', ['go', 'tool', 'cover', '-func=' + str(OUT / 'coverage.out')], backend)
        node = run('frontend', ['node', '--test', 'front end/tests/egress-view.test.mjs'])
        count = re.search(r'^# pass (\d+)$', node, re.M)
        if not count or not re.search(r'^# fail 0$', node, re.M):
            raise RuntimeError('Frontend test totals missing or failed')
        ts_path = Path(shutil.which('tsc') or '').resolve().parents[1]
        jsx_files = ['front end/src/features/implementation/EgressBoundaryPanel.jsx',
                     'front end/src/features/implementation/ImplementationCenter.jsx']
        js = """const ts=require(process.argv[1]),fs=require('node:fs');
for(const p of JSON.parse(process.argv[2])){
 const r=ts.transpileModule(fs.readFileSync(p,'utf8'),{fileName:p,reportDiagnostics:true,
 compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
 const errors=(r.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
 if(errors.length){console.error(errors);process.exit(1);}console.log('Syntax passed: '+p);
}"""
        run('jsx-syntax', ['node', '-e', js, str(ts_path), json.dumps(jsx_files)])
        report.update(passed=True, go_leaf_tests=len(leaf), frontend_tests=int(count[1]),
                      total=len(leaf)+int(count[1]), failed=0, go_race='passed', go_vet='passed', jsx_syntax_files=2,
                      go=run('go-version',['go','version']).strip(), node=run('node-version',['node','--version']).strip(),
                      coverage=coverage.strip().splitlines()[-1],
                      scope='Targeted local TLS/HTTP, synthetic authority/DNS/socket and presentation checks only',
                      not_verified=['deployed egress proxy/network policy/workload identity', 'Action Gateway permit/attempt ledger integration',
                                    'live customer endpoint/Kafka/databases', 'full frontend/media import, browser/accessibility and full repository regression',
                                    'production toolchain qualification, security review, backup/recovery and release gates'])
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
        report['error'] = str(error)
    (OUT / 'report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
    return 0 if report['passed'] else 1

if __name__ == '__main__':
    raise SystemExit(main())
