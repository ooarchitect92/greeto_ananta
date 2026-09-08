const fs = require('fs');
let code = fs.readFileSync('c:/xolox/xolox-new-backend1/oooo/frontend/src/components/CampaignsPage.jsx', 'utf-8');

const returnStart = code.indexOf('    return (\n        <div className="flex-1 flex flex-col h-full bg-gradient-to-br');
const returnEnd = code.indexOf('}\n\n// --- Main Campaigns Page -------------------------------------------------------');

if (returnStart !== -1 && returnEnd !== -1) {
    fs.writeFileSync('c:/xolox/xolox-new-backend1/oooo/frontend/scratch_ui.jsx', code.substring(returnStart, returnEnd));
    console.log('Extracted scratch_ui.jsx');
} else {
    console.log('Could not find boundaries');
}
