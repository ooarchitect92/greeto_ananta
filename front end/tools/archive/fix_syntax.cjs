const fs = require('fs');
let ui = fs.readFileSync('C:/Users/mruty/.gemini/antigravity-ide/brain/cc86f4a0-0067-4477-84f0-c01ac8e1a750/scratch/scratch_ui_new.jsx', 'utf-8');

ui = ui.replace(
    '{(step === 1 || step === 2) && {channel === \\'whatsapp\\' && headerFormat && (',
    '{(step === 1 || step === 2) && channel === \\'whatsapp\\' && headerFormat && ('
);
ui = ui.replace(')} }', ')}'); // Remove the extra closing brace

fs.writeFileSync('C:/Users/mruty/.gemini/antigravity-ide/brain/cc86f4a0-0067-4477-84f0-c01ac8e1a750/scratch/scratch_ui_new.jsx', ui);
console.log('Fixed syntax in scratch_ui_new.jsx');
