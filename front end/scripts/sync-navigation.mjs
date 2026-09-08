import fs from 'node:fs';
const base=new URL('../src/contracts/',import.meta.url);
const features=JSON.parse(fs.readFileSync(new URL('features.json',base),'utf8'));
const keys=['id','label','group','route','description','roles','sourceSection','component','uiStatus','serverStatus','dependencies'];
fs.writeFileSync(new URL('navigation.json',base),JSON.stringify(features.map(feature=>({...Object.fromEntries(keys.map(key=>[key,feature[key]])),parameterCount:feature.fields.length})),null,2)+'\n');
console.log(`Synchronized ${features.length} navigation entries.`);
