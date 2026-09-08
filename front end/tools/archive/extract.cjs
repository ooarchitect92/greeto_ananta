const fs = require('fs');
const code = fs.readFileSync('c:/xolox/xolox-new-backend1/oooo/frontend/src/components/CampaignsPage.jsx', 'utf-8');
const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('function NewCampaignPage('));
let end = start;
let braceCount = 0;
for (let i = start; i < lines.length; i++) {
  const line = lines[i];
  braceCount += (line.match(/\{/g) || []).length;
  braceCount -= (line.match(/\}/g) || []).length;
  if (braceCount === 0 && i > start) {
    end = i + 1;
    break;
  }
}
fs.writeFileSync('new_camp.jsx', lines.slice(start, end).join('\n'));
console.log('Extracted lines ' + start + ' to ' + end);
