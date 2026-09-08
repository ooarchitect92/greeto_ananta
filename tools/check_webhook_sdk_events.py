#!/usr/bin/env python3
"""Bounded INC-012 SDK/Go conformance checks; no installation, Git write or network.

Each language evaluates the SAME synthetic 74-case corpus. Counts distinguish
shared cases from language-specific tests; comparison also checks identities and
raw-body digests. The Go invocation runs only the new conformance test, not the
whole repository. Existing runtime contracts/versions are not changed here.
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
OUT = ROOT / '.local-build' / 'sdk-events'


def run(name: str, args: list[str], cwd: Path, report: str | None = None, timeout: int = 90) -> str:
    """Execute a fixed argument vector with bounded time and local evidence capture."""
    env = dict(os.environ, GOTOOLCHAIN='local', PYTHONDONTWRITEBYTECODE='1')
    env.pop('GREETO_CONFORMANCE_REPORT', None)
    if report:
        env['GREETO_CONFORMANCE_REPORT'] = str(OUT / report)
    result = subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True,
                            timeout=timeout, check=False)
    (OUT / (name + '.txt')).write_text(result.stdout + result.stderr, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(name + ' failed; inspect its evidence log')
    return result.stdout + result.stderr


def main() -> int:
    """Write failure-first summary, run scoped suites, compare every corpus result."""
    OUT.mkdir(parents=True, exist_ok=True)
    for filename in ('go.json', 'node.json', 'python.json'):
        (OUT / filename).unlink(missing_ok=True)
    result: dict = dict(increment='INC-012', passed=False, production_verified=False)
    summary = OUT / 'summary.json'
    summary.write_text(json.dumps(result, indent=2) + '\n')
    try:
        result['toolchains'] = {
            'go': run('go-version',['go','version'],ROOT,timeout=10).strip(),
            'node': run('node-version',['node','--version'],ROOT,timeout=10).strip(),
            'python': sys.version.split()[0],
            'typescript': run('ts-version',['tsc','--version'],ROOT,timeout=10).strip(),
        }
        new_go = ROOT / 'backend/services/webhook-dispatcher/receiving/sdk_conformance_test.go'
        if run('format',['gofmt','-l',str(new_go)],ROOT,timeout=10).strip():
            raise RuntimeError('Go formatting is not clean')
        gout = run('go-tests',['go','test','-race','-count=1','-json','-run','^TestSDKConformance$',
                   './services/webhook-dispatcher/receiving'],ROOT/'backend','go.json')
        events = [json.loads(line) for line in gout.splitlines() if line.startswith('{')]
        if any(e.get('Action') in ('fail','skip') for e in events):
            raise RuntimeError('Go test failed or skipped')
        go_count = sum(e.get('Action')=='pass' and e.get('Test','').startswith('TestSDKConformance/') for e in events)
        run('vet',['go','vet','./services/webhook-dispatcher/receiving','./services/webhook-dispatcher/signing'],ROOT/'backend')
        nout = run('node-tests',['node','--test','backend/sdk/typescript/webhook-event.test.mjs'],ROOT,'node.json')
        pout = run('python-tests',[sys.executable,'-m','unittest','-v','test_event'],ROOT/'backend/sdk/python','python.json')
        run('typescript',['tsc','--noEmit','--strict','--target','es2022','--module','nodenext',
                         '--moduleResolution','nodenext','backend/sdk/typescript/webhook-event.types.mts'],ROOT)
        n = re.search(r'# pass (\d+)\b',nout)
        p = re.search(r'Ran (\d+) tests?\b',pout)
        if n is None or p is None or not re.search(r'# fail 0\b',nout) or not re.search(r'# skipped 0\b',nout):
            raise RuntimeError('Test counts are missing or incomplete')
        corpus = json.loads((ROOT/'backend/testdata/webhook-event-v1.json').read_text())['cases']
        expected = {c['name'] for c in corpus}
        observed = []
        for filename in ('go.json','node.json','python.json'):
            records = json.loads((OUT/filename).read_text())
            if len(records)!=len(expected) or {r['name'] for r in records}!=expected:
                raise RuntimeError('Missing or duplicated conformance result')
            observed.append(sorted(records,key=lambda r:r['name']))
        if observed[0]!=observed[1] or observed[0]!=observed[2] or go_count!=len(expected):
            raise RuntimeError('Cross-language output differs')
        source_paths = [p for folder in ('backend/sdk/typescript','backend/sdk/python/greeto_webhooks',
                        'backend/services/webhook-dispatcher/receiving','backend/services/webhook-dispatcher/signing')
                        for p in (ROOT/folder).glob('*') if p.is_file()]
        result.update(passed=True,shared_vectors=len(expected),go_tests=go_count,node_tests=int(n[1]),
                      python_tests=int(p[1]),language_specific_tests=int(n[1])+int(p[1])-2*len(expected),
                      total_test_executions=go_count+int(n[1])+int(p[1]),failed=0,
                      cross_language_outputs='identical',go_race='passed',go_vet='passed',
                      strict_typescript='passed',python_checks='unit tests and typed source; no separate static type checker',
                      scope='Synthetic conformance and local SDK boundaries; no HTTP host, database, replay store or full regression',
                      sources=[{'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
                               for p in sorted(source_paths)])
    except (OSError,ValueError,RuntimeError,subprocess.TimeoutExpired) as error:
        result['failure']=type(error).__name__
    summary.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
    return 0 if result['passed'] else 1


if __name__=='__main__':
    sys.exit(main())
