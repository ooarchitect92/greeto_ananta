#!/usr/bin/env python3
"""Run this increment's bounded local checks; never migrate, deploy, or edit Git.

Parameters: none. Run from any directory using Python 3.10+.
Output: .local-build/foundation-report.json and subprocess test output.
Failure: nonzero exit on missing tools, failed tests, or invalid references.
This is not the full production/browser/cloud qualification pipeline.
"""
from __future__ import annotations
import csv
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / '.local-build' / 'foundation-report.json'


def run(name: str, command: list[str], cwd: Path) -> dict:
    """Execute an allowlisted developer check with a deadline; no shell expansion."""
    if shutil.which(command[0]) is None:
        return {'check': name, 'status': 'blocked', 'reason': 'tool_not_available', 'tool': command[0]}
    environment = dict(os.environ, GOPROXY='off', GOTOOLCHAIN='local')
    try:
        result = subprocess.run(command, cwd=cwd, env=environment, check=False, timeout=180)
    except subprocess.TimeoutExpired:
        return {'check': name, 'status': 'failed', 'reason': 'deadline_exceeded'}
    return {'check': name, 'status': 'passed' if result.returncode == 0 else 'failed', 'exit_code': result.returncode}


def contracts() -> dict:
    """Check local OpenAPI references and retained baseline IDs/dependency DAG.

    This is a structural/reference check, not a full independent OAS validator or
    a claim that HTTP handlers implement all the documented contracts.
    """
    api = json.loads((ROOT/'backend/contracts/openapi.json').read_text())
    def visit(value):
        if isinstance(value, dict):
            if '$ref' in value:
                pointer = value['$ref']
                if not pointer.startswith('#/'):
                    raise ValueError('unexpected_external_contract_reference')
                target = api
                for part in pointer[2:].split('/'):
                    target = target[part.replace('~1', '/').replace('~0', '~')]
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)
    visit(api)
    with (ROOT/'docs/delivery/baseline-index.csv').open(newline='') as source:
        index = list(csv.DictReader(source))
    for row in index:
        row['predecessors'] = [key for key in row['predecessors'].split(';') if key]
    by_id = {row['id']: row for row in index}
    if len(index) != 262 or len(by_id) != 262:
        raise ValueError('baseline_scope_mismatch')
    visited, active = set(), set()
    def dependencies(key):
        if key in active:
            raise ValueError('dependency_cycle')
        if key in visited:
            return
        active.add(key)
        for parent in by_id[key]['predecessors']:
            dependencies(parent)
        active.remove(key)
        visited.add(key)
    for key in by_id:
        dependencies(key)
    status = json.loads((ROOT/'docs/delivery/status.json').read_text())
    ui_status = json.loads((ROOT/'front end/src/contracts/delivery-status.json').read_text())
    if status != ui_status or status['certified_done'] != 0:
        raise ValueError('status_evidence_mismatch')
    return {'check':'contracts_and_baseline','status':'passed','work_packages':len(index),
            'openapi_paths':len(api['paths']),'schema_count':len(api['components']['schemas'])}


def main() -> int:
    """Run independent checks, record blockers, and return truthful overall status."""
    checks = []
    try:
        checks.append(contracts())
    except (ValueError, KeyError, OSError, TypeError):
        checks.append({'check':'contracts_and_baseline','status':'failed','reason':'invalid_contract_or_source'})
    checks.append(run('go_unit_and_race', ['go','test','-race','-count=1','./...'], ROOT/'backend'))
    checks.append(run('go_vet', ['go','vet','./...'], ROOT/'backend'))
    checks.append(run('typescript_strict', ['tsc','-p','backend/services/core/tsconfig.json'], ROOT))
    if checks[-1]['status'] == 'passed':
        checks.append(run('status_domain_tests', ['node','--experimental-default-type=module','--test',
            'backend/services/core/test/status-service.test.mjs'], ROOT))
    tests = sorted(str(p) for p in (ROOT/'front end/tests').glob('*.test.mjs'))
    checks.append(run('frontend_pure_contract_tests', ['node','--experimental-default-type=module','--test',*tests], ROOT))
    report = {'scope':'foundation_local_checks_only','checks':checks,'production_ready':False,
              'not_verified':['full_frontend_build_and_browser','live_sql_and_rls','kafka_cluster',
              'provider_end_to_end','kms_iam_rotation','backup_restore','secure_boot','security_certification','deployment']}
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))
    return 0 if all(c['status']=='passed' for c in checks) else 1

if __name__ == '__main__':
    sys.exit(main())
