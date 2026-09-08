const fs = require('fs');

let ui = fs.readFileSync('C:/Users/mruty/.gemini/antigravity-ide/brain/cc86f4a0-0067-4477-84f0-c01ac8e1a750/scratch/scratch_ui.jsx', 'utf-8');

// 1. Remove the header upload block from Step 2
const headerBlockStart = ui.indexOf("{channel === 'whatsapp' && headerFormat && (");
const headerBlockEnd = ui.indexOf(")}", headerBlockStart + 3500) + 2; // Need to be careful here

// Let's just find it explicitly by finding the next sibling's start
const varsBlockStart = ui.indexOf('<div className="space-y-4">\\n                                    <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">Dynamic Variables</h3>');

let headerBlock = "";
if (headerBlockStart !== -1 && varsBlockStart !== -1) {
    // The exact substring to remove
    const beforeVars = ui.substring(0, varsBlockStart);
    // Find the actual end of the header block which is right before vars block
    const actualEnd = beforeVars.lastIndexOf(")}", beforeVars.length - 1) + 2;
    
    headerBlock = ui.substring(headerBlockStart, actualEnd);
    ui = ui.substring(0, headerBlockStart) + ui.substring(actualEnd);
}

// 2. Fix aside sticky logic
const asideStart = ui.indexOf('<aside className="space-y-6">');
ui = ui.replace('<aside className="space-y-6">', '<aside className="space-y-6 sticky top-6 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pr-2 pb-4">');

// Remove sticky from Live Summary
ui = ui.replace('className="rounded-[2rem] border border-white/60 bg-white/70 backdrop-blur-md p-6 shadow-xl sticky top-0"', 'className="rounded-[2rem] border border-white/60 bg-white/70 backdrop-blur-md p-6 shadow-xl"');

// 3. Inject headerBlock into the sidebar and update Step 2 CampaignPreview to Step 1 & 2
const campaignPreviewStart = ui.indexOf('{step === 2 && (\\n                            <div className="animate-in fade-in slide-in-from-right-4 duration-500">\\n                                <CampaignPreview');
if (campaignPreviewStart !== -1) {
    const updatedCampaignPreview = \
                        \
                        {(step === 1 || step === 2) && (selectedTmpl || channel === 'sms') && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                <CampaignPreview channel={channel} template={selectedTmpl} mapping={mapping} smsMessage={smsMessage} headerUrl={headerUrl} headerFileName={headerFileName} contactFields={contactFields} />
                            </div>
                        )}\;
    
    // Replace the old CampaignPreview block
    const oldCampaignPreviewFull = \{step === 2 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                <CampaignPreview channel={channel} template={selectedTmpl} mapping={mapping} smsMessage={smsMessage} headerUrl={headerUrl} headerFileName={headerFileName} contactFields={contactFields} />
                            </div>
                        )}\;
    
    ui = ui.replace(oldCampaignPreviewFull, updatedCampaignPreview.trim());
}

fs.writeFileSync('C:/Users/mruty/.gemini/antigravity-ide/brain/cc86f4a0-0067-4477-84f0-c01ac8e1a750/scratch/scratch_ui_new.jsx', ui);
console.log('Modified UI written to scratch_ui_new.jsx');
