#!/usr/bin/env python3
"""Run bounded local INC-009 checks. No installs, credentials, network or Git writes.

Output: .local-build/webhook-lifecycle/report.json plus logs/coverage. This checks
only lifecycle source and its presentation, not the full application or live stores.
Existing foundation, ingress, SQL, outbox and egress suites remain separate gates.
"""
from pathlib import Path
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.local-build' / 'webhook-lifecycle'
PACKAGE = './services/webhook-dispatcher/lifecycle'


def run(args: list[str], name: str, cwd: Path = ROOT) -> str:
    """Run a local process with a 120s ceiling; retain output and fail on nonzero exit."""
    env = dict(os.environ, GOTOOLCHAIN='local', GOPROXY='off', GOSUMDB='off')
    completed = subprocess.run(args, cwd=cwd, env=env, text=True,
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=120)
    (OUT / name).write_text(completed.stdout, encoding='utf-8')
    if completed.returncode:
        raise RuntimeError(f'{name} failed; inspect {OUT / name}')
    return completed.stdout


def main() -> None:
    """Check format/race/vet/model/syntax and unchanged F03 projection; export evidence."""
    OUT.mkdir(parents=True, exist_ok=True)
    for tool in ('go', 'gofmt', 'node', 'tsc'):
        if not shutil.which(tool):
            raise RuntimeError(f'Required local tool is missing: {tool}; nothing is installed automatically.')
    package_path = ROOT / 'backend' / PACKAGE.removeprefix('./')
    if run(['gofmt', '-l', *map(str, sorted(package_path.glob('*.go')))], 'format.txt').strip():
        raise RuntimeError('Go source is not formatted; no automatic rewrite was applied.')
    go_log = run(['go', 'test', '-race', '-count=1', '-coverprofile=' + str(OUT / 'coverage.out'),
                  '-json', PACKAGE], 'go-tests.jsonl', ROOT / 'backend')
    run(['go', 'vet', PACKAGE], 'vet.txt', ROOT / 'backend')
    events = [json.loads(line) for line in go_log.splitlines() if line.startswith('{')]
    if any(e['Action'] in ('fail','skip') for e in events) or not any(e['Action']=='pass' and 'Test' not in e for e in events):
        raise RuntimeError('Go run did not pass all required checks.')
    names = {e['Test'] for e in events if e['Action']=='pass' and e.get('Test','').startswith('Test')}
    leaves = sorted(n for n in names if not any(other.startswith(n + '/') for other in names))
    tap = run(['node', '--test', 'front end/tests/delivery-lifecycle-view.test.mjs'], 'frontend.tap')
    counts = {k: int(v) for k,v in re.findall(r'^# (tests|pass|fail|cancelled|skipped) (\d+)$', tap, re.M)}
    if counts.get('tests',0)==0 or counts.get('pass')!=counts['tests'] or any(counts.get(k,0) for k in ('fail','cancelled','skipped')):
        raise RuntimeError('Frontend checks are incomplete.')
    compiler = Path(shutil.which('tsc')).resolve().parent.parent / 'lib' / 'typescript.js'
    jsx = [ROOT/'front end/src/features/implementation'/name for name in ('ImplementationCenter.jsx','WebhookDeliveryPanel.jsx')]
    syntax = """const fs=require('node:fs'),ts=require(process.argv[1]);
for(const file of process.argv.slice(2)){
 const r=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,
 compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
 if((r.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error))process.exit(1);
} console.log('2 JSX syntax checks passed; not a React build.');"""
    run(['node','-e',syntax,str(compiler),*map(str,jsx)], 'jsx.txt')
    status=json.loads((ROOT/'docs/delivery/status.json').read_text())
    ui=json.loads((ROOT/'front end/src/contracts/delivery-status.json').read_text())
    assert status==ui, 'Repository and UI evidence differ'
    assert status['baseline_count']==262
    assert [s['id'] for s in status['ingress_stages']]==[
        'edge_bounds','expected_credential','raw_proof','bounded_parse',
        'authorized_placement','durable_append','ack_boundary','async_consumers']
    coverage=run(['go','tool','cover','-func='+str(OUT/'coverage.out')], 'coverage.txt', ROOT/'backend')
    report={'increment':'INC-009','passed':True,'production_verified':False,
            'go_leaf_tests':len(leaves),'frontend_tests':counts['pass'],
            'total':len(leaves)+counts['pass'],'failed':0,'go_race':'passed','go_vet':'passed',
            'jsx_syntax_files':len(jsx),'projection_checks':'passed',
            'coverage':coverage.splitlines()[-1],
            'scope':'Local deterministic planner, scripted receipt ledger and presentation checks; not live DynamoDB or full regression.'}
    (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__ == '__main__':
    try:
        main()
    except (AssertionError, RuntimeError, OSError, subprocess.TimeoutExpired) as exc:
        print(f'Validation failed: {exc}', file=sys.stderr)
        sys.exit(1)
