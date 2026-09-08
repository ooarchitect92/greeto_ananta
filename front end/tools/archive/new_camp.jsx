function NewCampaignPage({ onClose, onSuccess }) {
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Step 0
    const [name, setName] = useState('');
    const [channel, setChannel] = useState('whatsapp');
    const [labelId, setLabelId] = useState('');
    const [labels, setLabels] = useState([]);
    const [loadingLabels, setLoadingLabels] = useState(false);
    const [labelsError, setLabelsError] = useState('');
    const [contactFields, setContactFields] = useState(BASE_CONTACT_FIELDS);
    const [groupContactsPreview, setGroupContactsPreview] = useState([]);
    const [audienceMode, setAudienceMode] = useState('existing');
    const [csvGroupName, setCsvGroupName] = useState('');
    const [csvFile, setCsvFile] = useState(null);
    const [csvBusy, setCsvBusy] = useState(false);

    // Step 1
    const [templates, setTemplates] = useState([]);
    const [tmplSearch, setTmplSearch] = useState('');
    const [selectedTmpl, setSelectedTmpl] = useState(null);
    const [loadingTmpls, setLoadingTmpls] = useState(false);
    const [smsMessage, setSmsMessage] = useState('');

    // Step 2
    const [mapping, setMapping] = useState({}); // { "1": "display_name", ... }
    const [headerUrl, setHeaderUrl] = useState('');
    const [headerFileName, setHeaderFileName] = useState('');
    const [headerUploading, setHeaderUploading] = useState(false);

    // Step 3
    const [scheduleMode, setScheduleMode] = useState('now'); // 'now' | 'later'
    const [scheduledAt, setScheduledAt] = useState('');

    useEffect(() => {
        setStep(0); setError('');
        setName(''); setChannel('whatsapp'); setLabelId(''); setSelectedTmpl(null);
        setMapping({}); setSmsMessage(''); setHeaderUrl(''); setHeaderFileName(''); setScheduleMode('now'); setScheduledAt('');
        setAudienceMode('existing'); setCsvGroupName(''); setCsvFile(null); setCsvBusy(false);

        setLoadingLabels(true);
        setLabelsError('');
        getLabels()
            .then(r => {
                const nextLabels = Array.isArray(r) ? r : (r.labels || r.data || []);
                setLabels(nextLabels);
                if (!nextLabels.length) setLabelsError('No labels found. Create a label and add contacts before launching a campaign.');
            })
            .catch(err => {
                console.error(err);
                setLabelsError('Unable to load labels. Please refresh and try again.');
            })
            .finally(() => setLoadingLabels(false));
    }, []);

    useEffect(() => {
        if (step !== 1 || channel === 'sms') return;
        setLoadingTmpls(true);
        const loader = channel === 'email' ? getEmailTemplates() : getTemplates();
        loader
            .then(r => setTemplates(channel === 'email' ? (r.items || []) : (r.data || [])))
            .catch(console.error)
            .finally(() => setLoadingTmpls(false));
    }, [step, channel]);

    // Reset mapping and header media when the selected template changes.
    useEffect(() => {
        if (!selectedTmpl) return;
        const vars = extractVarsFromTemplate(selectedTmpl);
        const initial = {};
        vars.forEach(v => { initial[v] = BASE_CONTACT_FIELDS[0].value; });
        setMapping(initial);
        setHeaderUrl('');
        setHeaderFileName('');
    }, [selectedTmpl]);

    useEffect(() => {
        let cancelled = false;
        if (!labelId) {
            setContactFields(BASE_CONTACT_FIELDS);
            setGroupContactsPreview([]);
            return undefined;
        }
        getLabelContacts(labelId).then((response) => {
            if (cancelled) return;
            const contacts = response?.contacts || response?.data || response || [];
            setGroupContactsPreview(contacts.slice(0, 3));
            
            const foundKeys = new Set();
            (Array.isArray(contacts) ? contacts : []).slice(0, 25).forEach((contact) => {
                if (contact.name || contact.displayName) foundKeys.add('name');
                if (contact.phone) foundKeys.add('phone');
                if (contact.email) foundKeys.add('email');
                Object.keys(contact?.profile || {}).forEach((key) => foundKeys.add(key));
            });
            const dynamicFields = [...foundKeys].sort().map((key) => ({
                value: key,
                label: key === 'name' ? 'Contact Name' : key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
            }));
            
            setContactFields(dynamicFields.length > 0 ? dynamicFields : BASE_CONTACT_FIELDS);
            
            setMapping(current => {
                const updated = { ...current };
                let changed = false;
                Object.keys(updated).forEach(varNum => {
                    if (dynamicFields.length > 0 && !dynamicFields.find(f => f.value === updated[varNum])) {
                        updated[varNum] = dynamicFields[0].value;
                        changed = true;
                    }
                });
                return changed ? updated : current;
            });
            
        }).catch(() => { 
            if (!cancelled) {
                setContactFields(BASE_CONTACT_FIELDS);
                setGroupContactsPreview([]);
            }
        });
        return () => { cancelled = true; };
    }, [labelId]);

    const vars = extractVarsFromTemplate(selectedTmpl);
    const headerFormat = getHeaderMediaFormat(selectedTmpl);
    const filteredTmpls = templates.filter(t =>
        (channel === 'email' || t.status === 'APPROVED') &&
        String(t.name || '').toLowerCase().includes(tmplSearch.toLowerCase())
    );

    // Validation per step
    const canNext = () => {
        if (step === 0) return name.trim() && labelId;
        if (step === 1) return channel === 'sms' ? smsMessage.trim() : Boolean(selectedTmpl);
        if (step === 2) return !headerFormat || Boolean(headerUrl);
        if (step === 3) return scheduleMode === 'now' || Boolean(scheduledAt);
        return false;
    };

    const handleNext = () => { setError(''); setStep(s => s + 1); };
    const handleBack = () => { setError(''); setStep(s => s - 1); };

    const handleHeaderFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setHeaderUploading(true);
        setError('');
        try {
            const result = await uploadFlowMedia(file);
            const url = result?.url || result?.link || result?.data?.url || '';
            if (!url) throw new Error('Upload did not return a media URL');
            setHeaderUrl(url);
            setHeaderFileName(file.name);
        } catch (uploadError) {
            setError(uploadError?.message || 'Header media upload failed.');
        } finally {
            setHeaderUploading(false);
            event.target.value = '';
        }
    };

    const importCampaignCsv = async () => {
        if (!csvGroupName.trim() || !csvFile) {
            setError('Enter a group name and choose a CSV file first.');
            return;
        }
        setCsvBusy(true);
        setError('');
        try {
            const result = await createLabelFromCsv(csvGroupName.trim(), csvFile);
            const label = result?.label || result?.data?.label || result?.data || result;
            if (!label?.id) throw new Error(result?.error || result?.message || 'CSV import did not create a contact group.');
            setLabels((current) => [label, ...current.filter((item) => item.id !== label.id)]);
            setLabelId(label.id);
            setAudienceMode('existing');
            setCsvGroupName('');
            setCsvFile(null);
        } catch (importError) {
            setError(importError?.message || 'CSV import failed.');
        } finally { setCsvBusy(false); }
    };

    const buildHeaderComponents = () => {
        if (!headerFormat || !headerUrl) return [];
        const mediaType = headerFormat.toLowerCase();
        const media = { link: headerUrl };
        if (headerFormat === 'DOCUMENT' && headerFileName) media.filename = headerFileName;
        return [{ type: 'header', parameters: [{ type: mediaType, [mediaType]: media }] }];
    };

    const handleSubmit = async () => {
        setSaving(true); setError('');
        try {
            const res = await createCampaign({
                name,
                channel_type: channel,
                label_id: labelId,
                template_name: selectedTmpl?.name || null,
                template_language: selectedTmpl?.language || 'en_US',
                email_template_id: channel === 'email' ? selectedTmpl?.id : null,
                subject: channel === 'email' ? selectedTmpl?.subject : null,
                message_body: channel === 'sms' ? smsMessage : null,
                template_components: channel === 'whatsapp' ? buildHeaderComponents() : [],
                variable_mapping: mapping,
                scheduled_at: scheduleMode === 'later' ? scheduledAt : null,
                send_immediately: scheduleMode === 'now',
            });
            if (res.success) {
                onSuccess({
                    ...res.campaign,
                    label_id: labelId,
                    label_name: selectedLabel?.name || res.campaign?.label_name || '',
                    total_contacts: res.campaign?.total_contacts ?? selectedLabel?.assigned_count ?? 0,
                });
                onClose();
            }
            else setError(res.error || 'Failed to create campaign.');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const selectedLabel = labels.find(l => l.id === labelId);

    return (
        <div className="flex-1 flex flex-col h-full bg-[#f7f3fb]">
            <div className="border-b border-purple-100 bg-white/95 px-6 py-4 shrink-0">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-10 w-10 rounded-2xl border border-purple-100 bg-white text-purple-700 shadow-sm hover:bg-purple-50 flex items-center justify-center"
                            title="Back to campaigns"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.24em] text-purple-500">Campaign Studio</p>
                            <h1 className="text-2xl font-bold text-slate-950">Create Campaign</h1>
                            <p className="text-sm text-slate-500">Build the audience, template mapping, and schedule in one focused page.</p>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-2 rounded-2xl border border-purple-100 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-800">
                        <MessageSquare size={16} />
                        <span className="capitalize">{channel}</span> campaign
                    </div>
                </div>
                <div className="mt-5 rounded-3xl border border-purple-100 bg-white px-5 py-4 shadow-sm">
                    <Steps current={step} steps={STEP_LABELS} />
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm">

            {/* ── Step 0: Campaign Info ── */}
            {step === 0 && (
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Campaign Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                            placeholder="e.g. Diwali Offer 2024"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Channel <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: 'whatsapp', icon: MessageSquare, label: 'WhatsApp' },
                                { id: 'email', icon: Mail, label: 'Email', disabled: true },
                                { id: 'sms', icon: Smartphone, label: 'SMS', disabled: true },
                            ].map(ch => (
                                <button
                                    key={ch.id}
                                    type="button"
                                    disabled={ch.disabled}
                                    onClick={() => { setChannel(ch.id); setSelectedTmpl(null); setTemplates([]); setMapping({}); }}
                                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all disabled:cursor-not-allowed disabled:opacity-55 ${channel === ch.id
                                            ? 'border-purple-600 bg-purple-50'
                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                        }`}
                                >
                                    <ch.icon size={22} className={channel === ch.id ? 'text-purple-600' : 'text-slate-400'} />
                                    <span className={`text-xs font-medium ${channel === ch.id ? 'text-purple-600' : 'text-slate-500'}`}>{ch.label}</span>
                                    {ch.disabled && <span className="text-[10px] font-semibold text-slate-400">Coming soon</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                            <label className="block text-sm font-medium text-slate-700">Contact Group <span className="text-red-500">*</span></label>
                            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
                                <button type="button" onClick={() => setAudienceMode('existing')} className={`rounded-md px-2.5 py-1.5 ${audienceMode === 'existing' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}>Existing group</button>
                                <button type="button" onClick={() => setAudienceMode('csv')} className={`rounded-md px-2.5 py-1.5 ${audienceMode === 'csv' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}>Upload CSV</button>
                            </div>
                        </div>
                        {audienceMode === 'existing' && <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                            value={labelId}
                            onChange={e => setLabelId(e.target.value)}
                            disabled={loadingLabels}
                        >
                            <option value="">— Select a group —</option>
                            {labels.map(l => (
                                <option key={l.id} value={l.id}>{l.name} ({Number(l.assigned_count || 0).toLocaleString('en-IN')} contacts)</option>
                            ))}
                        </select>}
                        {audienceMode === 'existing' && labelsError && <p className="mt-2 text-xs font-medium text-amber-600">{labelsError}</p>}
                        {audienceMode === 'csv' && (
                            <div className="rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/30 p-5 transition-colors hover:bg-purple-50/50">
                                <div className="flex flex-col gap-4">
                                    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                                        <div className="relative">
                                            <input 
                                                className="w-full rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-transparent focus:ring-2 focus:ring-purple-400 shadow-sm" 
                                                placeholder="Enter new group name..." 
                                                value={csvGroupName} 
                                                onChange={(event) => setCsvGroupName(event.target.value)} 
                                            />
                                        </div>
                                        <label className="flex h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-6 text-sm font-bold text-purple-700 shadow-sm transition-all hover:border-purple-300 hover:bg-purple-50 hover:shadow">
                                            <Upload size={16} />
                                            {csvFile ? csvFile.name : 'Select CSV File'}
                                            <input 
                                                type="file" 
                                                accept=".csv,text/csv" 
                                                className="sr-only" 
                                                onChange={(event) => setCsvFile(event.target.files?.[0] || null)} 
                                            />
                                        </label>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 border-t border-purple-100 pt-4">
                                        <div className="flex items-start gap-2 text-purple-600/80">
                                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                            <p className="text-[11px] leading-relaxed font-medium">
                                                Include a <span className="font-bold text-purple-700">phone</span> or <span className="font-bold text-purple-700">mobile</span> column.<br/>Other columns become custom variables.
                                            </p>
                                        </div>
                                        <Button 
                                            type="button" 
                                            onClick={importCampaignCsv} 
                                            disabled={csvBusy} 
                                            className="h-[40px] shrink-0 rounded-xl bg-purple-600 px-5 text-sm font-bold text-white shadow-md transition-all hover:bg-purple-700 hover:shadow-lg focus:ring-2 focus:ring-purple-400 focus:ring-offset-1 disabled:opacity-70 disabled:shadow-none"
                                        >
                                            {csvBusy ? (
                                                <span className="flex items-center gap-2">
                                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                                                    Importing...
                                                </span>
                                            ) : 'Create group'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Step 1: Template Selection ── */}
            {step === 1 && (
                <div className="space-y-4">
                    {channel === 'sms' ? (
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">SMS message <span className="text-red-500">*</span></label>
                            <textarea
                                rows={7}
                                maxLength={1000}
                                value={smsMessage}
                                onChange={(event) => setSmsMessage(event.target.value)}
                                placeholder="Write your message. Use {{display_name}}, {{external_id}} or {{email}} for personalization."
                                className="w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                            />
                            <div className="mt-1 flex justify-between text-xs text-slate-400">
                                <span>Sent through the workspace Fast2SMS connection.</span>
                                <span>{smsMessage.length}/1000</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                <Search size={14} className="text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={channel === 'email' ? 'Search email templates...' : 'Search approved templates...'}
                                    className="w-full text-sm bg-transparent outline-none"
                                    value={tmplSearch}
                                    onChange={e => setTmplSearch(e.target.value)}
                                />
                            </div>
                            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                                {loadingTmpls ? (
                                    <GreetoLoader label="Loading templates..." sublabel="Fetching approved campaign assets" />
                                ) : filteredTmpls.length === 0 ? (
                                    <p className="text-center text-slate-500 text-sm py-8">No {channel === 'email' ? 'email' : 'approved WhatsApp'} templates found.</p>
                                ) : filteredTmpls.map(t => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setSelectedTmpl(t)}
                                        className={`w-full text-left rounded-xl border-2 p-4 transition-all ${selectedTmpl?.id === t.id
                                                ? 'border-purple-600 bg-purple-50'
                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-sm text-slate-900">{t.name}</p>
                                                {channel === 'email' && (
                                                    <>
                                                        <p className="mt-0.5 text-xs text-slate-500">{t.subject || 'No subject'}</p>
                                                        <p className="mt-2 line-clamp-2 text-xs text-slate-600">{t.text_body || String(t.html_body || '').replace(/<[^>]+>/g, ' ')}</p>
                                                    </>
                                                )}
                                                {channel !== 'email' && (<>
                                                <p className="text-xs text-slate-500 mt-0.5 capitalize">{t.category} · {t.language}</p>
                                                <p className="text-xs text-slate-600 mt-2 line-clamp-2">{getBodyText(t)}</p>
                                                </>)}
                                            </div>
                                            {selectedTmpl?.id === t.id && (
                                                <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Check size={11} className="text-white" strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Step 2: Variable Mapping + Preview ── */}
            {step === 2 && (
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                        {channel === 'whatsapp' && headerFormat && (
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                                    {headerFormat === 'IMAGE' ? <Image size={14} className="text-purple-600" /> : headerFormat === 'VIDEO' ? <Video size={14} className="text-purple-600" /> : <FileIcon size={14} className="text-purple-600" />}
                                    <span className="text-xs font-semibold text-slate-700">{headerFormat.charAt(0) + headerFormat.slice(1).toLowerCase()} header</span>
                                    <span className="ml-auto text-[10px] font-semibold text-red-500">Required</span>
                                </div>
                                <div className="space-y-2 p-3">
                                    {headerUrl && (
                                        <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-2">
                                            {headerFormat === 'IMAGE' ? <img src={headerUrl} alt="Selected header" className="h-10 w-10 rounded object-cover" /> : headerFormat === 'VIDEO' ? <Video size={20} className="text-emerald-600" /> : <FileIcon size={20} className="text-emerald-600" />}
                                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-emerald-800">{headerFileName || headerUrl}</span>
                                            <button type="button" onClick={() => { setHeaderUrl(''); setHeaderFileName(''); }} className="text-emerald-700 hover:text-red-600" title="Remove selected media"><X size={15} /></button>
                                        </div>
                                    )}
                                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-purple-300 px-3 py-2.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-50">
                                        <Upload size={14} />
                                        {headerUploading ? 'Uploading media...' : headerUrl ? 'Replace media' : `Select ${headerFormat.toLowerCase()}`}
                                        <input
                                            type="file"
                                            className="sr-only"
                                            disabled={headerUploading}
                                            accept={headerFormat === 'IMAGE' ? 'image/*' : headerFormat === 'VIDEO' ? 'video/*' : 'application/pdf,.doc,.docx,.xlsx,.pptx'}
                                            onChange={handleHeaderFileChange}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}
                        <p className="text-sm font-medium text-slate-700">Map Variables to Contact Fields</p>
                        {vars.length === 0 ? (
                            <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-4">
                                This template has no variables — nothing to map!
                            </p>
                        ) : vars.map(varNum => (
                            <div key={varNum}>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                    {'{{'}{varNum}{'}}'}
                                </label>
                                <select
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-purple-500"
                                    value={mapping[varNum] || ''}
                                    onChange={e => setMapping(m => ({ ...m, [varNum]: e.target.value }))}
                                >
                                    {contactFields.map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                </select>
                            </div>
                        ))}

                        {/* Group Contacts Preview Table */}
                        {groupContactsPreview.length > 0 && (
                            <div className="mt-8 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                                    <p className="text-sm font-semibold text-slate-800">Uploaded Contacts Preview</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Showing {groupContactsPreview.length} contacts from this group to help you map variables accurately.</p>
                                </div>
                                <div className="overflow-x-auto max-h-[300px]">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white border-b border-slate-100">
                                            <tr>
                                                {contactFields.map(f => <th key={f.value} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{f.label}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {groupContactsPreview.map((contact, i) => (
                                                <tr key={i} className="hover:bg-slate-50/50">
                                                    {contactFields.map(f => {
                                                        let val = contact[f.value] !== undefined ? contact[f.value] : contact?.profile?.[f.value];
                                                        if (f.value === 'name' && !val) val = contact.displayName;
                                                        return <td key={f.value} className="px-4 py-3 text-slate-700 whitespace-nowrap">{typeof val === 'object' ? JSON.stringify(val) : String(val || '-')}</td>
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                    <CampaignPreview channel={channel} template={selectedTmpl} mapping={mapping} smsMessage={smsMessage} headerUrl={headerUrl} headerFileName={headerFileName} contactFields={contactFields} />
                </div>
            )}

            {/* ── Step 3: Schedule ── */}
            {step === 3 && (
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => setScheduleMode('now')}
                            className={`flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all ${scheduleMode === 'now' ? 'border-purple-600 bg-purple-50' : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <Zap size={28} className={scheduleMode === 'now' ? 'text-purple-600' : 'text-slate-400'} />
                            <div>
                                <p className={`font-semibold text-sm ${scheduleMode === 'now' ? 'text-purple-700' : 'text-slate-700'}`}>Send Now</p>
                                <p className="text-xs text-slate-500 mt-0.5">Campaign will start immediately after creation</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setScheduleMode('later')}
                            className={`flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all ${scheduleMode === 'later' ? 'border-purple-600 bg-purple-50' : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <Clock size={28} className={scheduleMode === 'later' ? 'text-purple-600' : 'text-slate-400'} />
                            <div>
                                <p className={`font-semibold text-sm ${scheduleMode === 'later' ? 'text-purple-700' : 'text-slate-700'}`}>Schedule</p>
                                <p className="text-xs text-slate-500 mt-0.5">Pick a future date and time</p>
                            </div>
                        </button>
                    </div>

                    {scheduleMode === 'later' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Schedule Date & Time</label>
                            <input
                                type="datetime-local"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                                value={scheduledAt}
                                min={new Date().toISOString().slice(0, 16)}
                                onChange={e => setScheduledAt(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Summary */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
                        <p className="font-medium text-slate-700">Campaign Summary</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                            <span className="text-slate-400">Name</span>        <span className="font-medium text-slate-800">{name}</span>
                            <span className="text-slate-400">Channel</span>     <span className="font-medium capitalize">{channel}</span>
                            <span className="text-slate-400">Group</span>       <span className="font-medium">{labels.find(l => l.id === labelId)?.name || '—'}</span>
                            <span className="text-slate-400">Content</span>     <span className="font-medium">{channel === 'sms' ? 'Custom SMS message' : selectedTmpl?.name || 'None'}</span>
                            <span className="text-slate-400">Schedule</span>    <span className="font-medium">{scheduleMode === 'now' ? 'Immediate' : scheduledAt || 'Not set'}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
                <Button variant="outline" onClick={step === 0 ? onClose : handleBack}>
                    {step === 0 ? 'Cancel' : <><ChevronLeft size={15} /> Back</>}
                </Button>
                <Button
                    className="bg-purple-700 hover:bg-purple-800 text-white flex items-center gap-1.5"
                    disabled={!canNext() || saving}
                    onClick={step === STEP_LABELS.length - 1 ? handleSubmit : handleNext}
                >
                    {step === STEP_LABELS.length - 1
                        ? (saving ? 'Launching...' : <><Send size={14} /> Launch Campaign</>)
                        : <>Next <ChevronRight size={15} /></>
                    }
                </Button>
            </div>
                    </div>

                    <aside className="space-y-4">
                        <div className="rounded-3xl border border-purple-100 bg-white p-5 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-500">Live Summary</p>
                            <div className="mt-4 space-y-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-slate-500">Name</span>
                                    <span className="max-w-[180px] truncate font-semibold text-slate-900">{name || 'Untitled campaign'}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-slate-500">Group</span>
                                    <span className="max-w-[180px] truncate font-semibold text-slate-900">{selectedLabel?.name || 'Not selected'}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-slate-500">Template</span>
                                    <span className="max-w-[180px] truncate font-semibold text-slate-900">{channel === 'sms' ? (smsMessage ? 'Custom SMS message' : 'Not written') : selectedTmpl?.name || 'Not selected'}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-slate-500">Schedule</span>
                                    <span className="font-semibold text-slate-900">{scheduleMode === 'now' ? 'Immediate' : scheduledAt || 'Pending'}</span>
                                </div>
                            </div>
                        </div>
                    </aside>

                </div>
            </div>
        </div>
    );
}