const fs = require('fs');
const oldFile = fs.readFileSync('c:/xolox/xolox-new-backend1/oooo/frontend/src/components/CampaignsPage.jsx', 'utf-8');
const newUi = fs.readFileSync('C:/Users/mruty/.gemini/antigravity-ide/brain/cc86f4a0-0067-4477-84f0-c01ac8e1a750/scratch/scratch_ui_new.jsx', 'utf-8');

const returnStart = oldFile.indexOf('    return (\r\n        <div className="flex-1 flex flex-col h-full bg-gradient-to-br');
const returnStartLinux = oldFile.indexOf('    return (\n        <div className="flex-1 flex flex-col h-full bg-gradient-to-br');
const actualStart = returnStart !== -1 ? returnStart : returnStartLinux;

const mainPageStart = oldFile.indexOf('export default function CampaignsPage');
const actualEnd = oldFile.lastIndexOf('    );', mainPageStart) + 6;

if (actualStart === -1 || actualEnd === -1) {
    console.error('Could not find boundaries', actualStart, actualEnd);
} else {
    const finalCode = oldFile.substring(0, actualStart) + newUi + '\n}\n\n// --- Main Campaigns Page -------------------------------------------------------\n' + oldFile.substring(mainPageStart);
    fs.writeFileSync('c:/xolox/xolox-new-backend1/oooo/frontend/src/components/CampaignsPage.jsx', finalCode);
    console.log('Successfully replaced UI');
}
