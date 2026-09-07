#!/usr/bin/env python3
"""Run INC-006's bounded local checks. No installs, network, DB or Git mutations.

Usage: python tools/check_status_outbox.py
Inputs: existing Node and TypeScript executables on PATH.
Outputs: .local-build/status-outbox-report.json, TAP and JSX syntax diagnostics.
Scope: new outbox scripted-port tests plus existing tenant/projection regressions.
This does not replace check_foundation.py/check_status_store.py or release gates.
"""
from __future__ import annotations
import json
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / ".local-build"
BASE_FLAGS = ["--strict", "--noUncheckedIndexedAccess", "--exactOptionalPropertyTypes",
              "--target", "ES2022", "--module", "ES2022", "--moduleResolution", "bundler",
              "--lib", "ES2023,DOM", "--skipLibCheck"]


def run(command: list[str], timeout: int = 90) -> str:
    """Run an explicit local executable; capture output and stop on a failed gate."""
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True,
                            encoding="utf-8", errors="replace", timeout=timeout)
    if result.returncode:
        raise RuntimeError(f"Check failed ({result.returncode}): {command[0]}\n{result.stdout}\n{result.stderr}")
    return result.stdout + result.stderr


def main() -> int:
    """Compile and run named suites; emit evidence, never a production-ready flag."""
    BUILD.mkdir(exist_ok=True)
    report: dict[str, object] = {"increment": "INC-006", "scope": "local scripted ports and presentation",
                              "production_verified": False, "passed": False}
    try:
        node, tsc = shutil.which("node"), shutil.which("tsc")
        if not node or not tsc:
            raise RuntimeError("Node and the existing TypeScript compiler are required; no installer is run.")
        report["node"] = run([node, "--version"]).strip()
        report["typescript"] = run([tsc, "--version"]).strip()
        platform = "backend/services/core/src/platform/"
        delivery = "backend/services/core/src/delivery/"
        groups = {
            "status-outbox": [platform+"tenant-scope.ts", platform+"postgres-scope-reader.ts",
                             delivery+"status-outbox-contract.ts", delivery+"postgres-status-outbox.ts",
                             delivery+"status-outbox-relay.ts"],
            "tenant-scope": [platform+"tenant-scope.ts", platform+"postgres-scope-reader.ts"]
        }
        for name, files in groups.items():
            dest = BUILD / name
            dest.mkdir(exist_ok=True)
            run([tsc, *BASE_FLAGS, "--outDir", str(dest), *files])
            (dest/"package.json").write_text('{"type":"module"}\n', encoding="utf-8")
        report["strict_typescript"] = "passed"
        suites = [
            "backend/services/core/test/status-outbox.test.mjs",
            "backend/services/core/test/tenant-scope.test.mjs",
            "front end/tests/outbox-view.test.mjs",
            "front end/tests/tenant-scope-model.test.mjs",
            "front end/tests/placement-status.test.mjs"
        ]
        tap = run([node, "--test", *suites])
        (BUILD/"status-outbox-tests.tap").write_text(tap, encoding="utf-8")
        counts = {key:int(value) for key,value in re.findall(r"^# (tests|pass|fail|cancelled|skipped) (\d+)$", tap, re.M)}
        if counts.get("fail") != 0 or counts.get("pass",0) < 1 or counts.get("cancelled",0):
            raise RuntimeError("Tests did not produce a clean passing TAP summary.")
        report["tests"] = counts
        # transpileModule is syntax-only: no fake React/NestJS declarations or ignored
        # type diagnostics are substituted for a real application/browser build.
        library = Path(tsc).resolve().parent.parent/"lib"/"typescript.js"
        if not library.is_file():
            library = Path(run([node, "-p", "require.resolve('typescript', {paths: [process.cwd(), process.argv[1]]})",
                                str(Path(tsc).parent)]).strip())
        syntax = r"""
const ts=require(process.argv[1]),fs=require('node:fs');
for(const file of process.argv.slice(2)){
  const result=ts.transpileModule(fs.readFileSync(file,'utf8'),{
    fileName:file,reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.Preserve}});
  const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  if(errors.length)throw new Error(errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
}
"""
        jsx = ["front end/src/features/implementation/OutboxStatusPanel.jsx",
               "front end/src/features/implementation/ImplementationCenter.jsx"]
        run([node, "-e", syntax, str(library), *jsx])
        report["jsx_syntax_files"] = len(jsx)
        report["passed"] = True
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        report["error"] = str(error)
    (BUILD/"status-outbox-report.json").write_text(json.dumps(report,indent=2)+"\n", encoding="utf-8")
    print(json.dumps(report,indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
