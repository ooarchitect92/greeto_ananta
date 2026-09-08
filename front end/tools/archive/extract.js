const fs = require('fs');
const code = fs.readFileSync('c:/xolox/xolox-new-backend1/oooo/frontend/src/components/CampaignsPage.jsx', 'utf-8');
const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('function NewCampaignPage('));
const end = lines.findIndex((l, i) => i > start && l.startsWith('}')) + 1;
fs.writeFileSync('new_camp.jsx', lines.slice(start, end).join('\n'));
console.log('Extracted lines ' + start + ' to ' + end);
