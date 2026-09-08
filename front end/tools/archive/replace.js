const fs = require('fs');
const oldFile = fs.readFileSync('c:/xolox/xolox-new-backend1/oooo/frontend/src/components/CampaignsPage.jsx', 'utf-8');
const newUi = fs.readFileSync('C:/Users/mruty/.gemini/antigravity-ide/brain/cc86f4a0-0067-4477-84f0-c01ac8e1a750/scratch/new_ui.jsx', 'utf-8');

const returnStart = oldFile.indexOf('    return (\r\n        <div className="flex-1 flex flex-col h-full bg-[#f7f3fb]">');
const returnStartLinux = oldFile.indexOf('    return (\n        <div className="flex-1 flex flex-col h-full bg-[#f7f3fb]">');
const actualStart = returnStart !== -1 ? returnStart : returnStartLinux;

const returnEnd = oldFile.indexOf('    );\r\n}\r\n\r\n// --- Main Campaigns Page');
const returnEndLinux = oldFile.indexOf('    );\n}\n\n// --- Main Campaigns Page');
const actualEnd = returnEnd !== -1 ? returnEnd : returnEndLinux;

if (actualStart === -1 || actualEnd === -1) {
    console.error('Could not find boundaries', actualStart, actualEnd);
    // Let's print out the file around the expected start to debug
    console.log(oldFile.substring(oldFile.indexOf('handleBack ='), oldFile.indexOf('handleBack =') + 200));
} else {
    const finalCode = oldFile.substring(0, actualStart) + newUi + oldFile.substring(actualEnd);
    fs.writeFileSync('c:/xolox/xolox-new-backend1/oooo/frontend/src/components/CampaignsPage.jsx', finalCode);
    console.log('Successfully replaced UI');
}
