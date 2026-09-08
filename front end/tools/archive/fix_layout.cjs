const fs = require('fs');
let code = fs.readFileSync('c:/xolox/xolox-new-backend1/oooo/frontend/src/components/CampaignsPage.jsx', 'utf-8');

const returnStart = code.indexOf('    return (\n        <div className="flex-1 flex flex-col h-full bg-gradient-to-br');
const returnStartWin = code.indexOf('    return (\r\n        <div className="flex-1 flex flex-col h-full bg-gradient-to-br');
const actualStart = returnStart !== -1 ? returnStart : returnStartWin;
const returnEnd = code.indexOf('}\n\n// --- Main Campaigns Page -------------------------------------------------------');
const returnEndWin = code.indexOf('}\r\n\r\n// --- Main Campaigns Page -------------------------------------------------------');
const actualEnd = returnEnd !== -1 ? returnEnd : returnEndWin;

if (actualStart !== -1 && actualEnd !== -1) {
    fs.writeFileSync('C:/Users/mruty/.gemini/antigravity-ide/brain/cc86f4a0-0067-4477-84f0-c01ac8e1a750/scratch/scratch_ui.jsx', code.substring(actualStart, actualEnd));
    console.log('Extracted scratch_ui.jsx');
} else {
    console.log('Could not find boundaries');
}
