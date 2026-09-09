#!/usr/bin/env python3
"""Bounded INC-017 checks. Uses existing Node/tsc/types; never installs dependencies.

Run from any working directory. This is a scoped domain/presentation run, not a
replacement for the full frontend, database, Meta or original acceptance suites.
"""
from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.local-build/signup-attempts'
MODULE='backend/services/core/src/channels/meta/signup-attempt.ts'


def run(name,args,timeout=45,env=None):
    """Use a fixed argument vector, retain stdout/stderr and reject nonzero exits."""
    result=subprocess.run(args,cwd=ROOT,env=env,capture_output=True,text=True,timeout=timeout,check=False)
    (OUT/(name+'.txt')).write_text(result.stdout+result.stderr,encoding='utf-8')
    if result.returncode:
        raise RuntimeError(name+' failed; inspect local evidence')
    return result.stdout


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    report={'increment':'INC-017','passed':False,'production_verified':False,'publication':'not_determined_by_tests'}
    target=OUT/'summary.json'
    target.write_text(json.dumps(report,indent=2)+'\n')
    try:
        report['node']=run('node-version',['node','--version'],10).strip()
        report['typescript']=run('tsc-version',['tsc','--version'],10).strip()
        global_root=Path(run('npm-root',['npm','root','-g'],10).strip())
        roots=[ROOT/'backend/node_modules/@types',ROOT/'front end/node_modules/@types',ROOT/'node_modules/@types',global_root/'ts-node/node_modules/@types']
        if os.environ.get('GREETO_NODE_TYPE_ROOT'):
            roots.insert(0,Path(os.environ['GREETO_NODE_TYPE_ROOT']))
        type_root=next((p for p in roots if (p/'node/package.json').is_file()),None)
        if type_root is None:
            raise RuntimeError('Existing @types/node required; set GREETO_NODE_TYPE_ROOT. No install attempted.')
        compiler=['tsc','--strict','--target','es2022','--module','commonjs','--lib','es2022,dom','--types','node','--typeRoots',str(type_root),'--skipLibCheck']
        run('compile',compiler+['--outDir',str(OUT),MODULE])
        run('readonly-consumer',compiler+['--noEmit','backend/services/core/tests/meta-signup-attempt.types.ts'])
        totals={}
        for name,path in [('backend','backend/services/core/tests/meta-signup-attempt.test.mjs'),('frontend','front end/tests/meta-signup-attempt.test.mjs')]:
            text=run(name+'-tests',['node','--test',path])
            count={key:int(re.search(r'^# '+key+r' (\d+)$',text,re.M).group(1)) for key in ['tests','pass','fail','cancelled','skipped']}
            if count['pass']!=count['tests'] or any(count[k] for k in ['fail','cancelled','skipped']):
                raise RuntimeError('Incomplete named test run')
            totals[name]=count
        jsx='front end/src/features/channels/meta/MetaSignupSetupPanel.jsx'
        parser="const fs=require('node:fs');const ts=require('typescript');const f=process.argv[1];const s=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);if(s.parseDiagnostics.length)process.exit(1);console.log('JSX syntax passed; not a render test');"
        env=dict(os.environ,NODE_PATH=str(global_root))
        run('jsx-syntax',['node','-e',parser,jsx],15,env)
        sources=[MODULE,'backend/services/core/tests/meta-signup-attempt.test.mjs','backend/services/core/tests/meta-signup-attempt.types.ts',
                 jsx,'front end/src/features/channels/meta/signup-attempt-model.mjs','front end/tests/meta-signup-attempt.test.mjs']
        report.update(passed=True,tests=totals,total_named_tests=sum(v['tests'] for v in totals.values()),strict_types='passed',jsx_syntax_files=1,
                      runtime_bindings='synthetic authority/repository/vault, no HTTP/SDK/provider/DB/KMS connection',
                      unchanged_setup_sha256=hashlib.sha256((ROOT/'backend/services/core/src/channels/meta/signup-configuration.ts').read_bytes()).hexdigest(),
                      source_hashes={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sources})
    except (OSError,ValueError,RuntimeError,subprocess.TimeoutExpired,AttributeError) as exc:
        report['failure']=type(exc).__name__
    target.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))
    return 0 if report['passed'] else 1


if __name__=='__main__':
    sys.exit(main())
