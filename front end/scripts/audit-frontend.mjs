import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'src/contracts',name),'utf8'));
const features=read('features.json'),nav=read('navigation.json'),tasks=read('work-packages.json'),groups=read('navigation-groups.json');
const errors=[];let checkedImports=0;
const check=(condition,message)=>{if(!condition)errors.push(message);};
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
function resolveImport(from,spec){const base=spec.startsWith('@/')?path.join(root,'src',spec.slice(2)):path.resolve(path.dirname(from),spec);return ['', '.js','.jsx','.json','.css','/index.js','/index.jsx'].some(ext=>fs.existsSync(base+ext)&&fs.statSync(base+ext).isFile());}
for(const file of walk(path.join(root,'src')).filter(file=>/\.(jsx?|tsx?)$/.test(file))){
 const text=fs.readFileSync(file,'utf8');
 const expression=/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\bvi\.mock\(\s*)['"]([^'"]+)['"]/g;
 for(const match of text.matchAll(expression)){
  const spec=match[1];if(!spec.startsWith('.')&&!spec.startsWith('@/'))continue;
  checkedImports++;check(resolveImport(file,spec),`Unresolved import ${path.relative(root,file)} -> ${spec}`);
 }
}
check(features.length===55,`Expected 55 feature entries; got ${features.length}`);
check(tasks.length===262,`Expected 262 source work packages; got ${tasks.length}`);
check(new Set(features.map(f=>f.id)).size===features.length,'Duplicate feature IDs');
check(new Set(tasks.map(t=>t.id)).size===tasks.length,'Duplicate work-package IDs');
check(new Set(tasks.map(t=>t.domain)).size===27,'Work-package domain count changed');
for(const feature of features){
 check(groups.some(g=>g.id===feature.group),`Unknown group for ${feature.id}`);
 check(fs.existsSync(path.join(root,feature.component)),`Missing component ${feature.component}`);
 check(feature.roles.length>0,`No role contract for ${feature.id}`);
 const projected=nav.find(f=>f.id===feature.id);
 check(projected?.parameterCount===feature.fields.length,`Navigation count drift: ${feature.id}`);
 for(const key of ['id','label','group','route','description','roles','sourceSection','component','uiStatus','serverStatus','dependencies'])check(JSON.stringify(projected?.[key])===JSON.stringify(feature[key]),`Navigation metadata drift: ${feature.id}.${key}`);
 check(new Set(feature.fields.map(f=>f.name)).size===feature.fields.length,`Duplicate parameter in ${feature.id}`);
 for(const dep of feature.dependencies)check(features.some(f=>f.id===dep),`Unknown feature dependency ${feature.id} -> ${dep}`);
 for(const id of feature.workPackageIds)check(tasks.some(t=>t.id===id),`Unknown work-package link ${id}`);
 for(const field of feature.fields){check(typeof field.required==='boolean',`Missing required rule ${feature.id}.${field.name}`);check(Object.hasOwn(field,'default'),`Missing default ${feature.id}.${field.name}`);check(Boolean(field.description),`Missing help ${feature.id}.${field.name}`);}
 if(feature.uiStatus==='frontend_configuration')check(feature.serverStatus==='not_connected',`Misleading backend status: ${feature.id}`);
}
for(const task of tasks){
 check(features.some(f=>f.id===task.frontendFeature),`No feature mapping: ${task.id}`);
 check(task.deliveryStatus==='not_started',`Unjustified completion status: ${task.id}`);
 check(Boolean(task.acceptance)&&Boolean(task.acceptanceTestId)&&Number.isInteger(task.sourceRow),`Missing acceptance/source: ${task.id}`);
 for(const dep of task.predecessors)check(tasks.some(t=>t.id===dep),`Unknown source predecessor ${task.id} -> ${dep}`);
}
const result={features:features.length,parameters:features.reduce((n,f)=>n+f.fields.length,0),workPackages:tasks.length,domains:27,checkedImports,errors};
console.log(JSON.stringify(result,null,2));if(errors.length)process.exitCode=1;
