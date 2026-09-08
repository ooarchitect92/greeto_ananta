import { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import {
  CheckCircle2, Copy, Eye, EyeOff, KeyRound, Loader2, LockKeyhole,
  Mail, ShieldCheck, ShieldOff, UserRound, X,
} from 'lucide-react';
import {
  changeMyPassword, confirmTwoFactor, disableTwoFactor, getMyProfile, setupTwoFactor,
} from './api.js';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';

const fieldClass = 'h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-11 text-sm font-semibold text-slate-900 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100';

function PasswordField({ label, value, onChange, visible, onToggle, autoComplete }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <div className="relative">
        <input type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className={fieldClass} />
        <button type="button" onClick={onToggle} className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}

export default function AdminSettingsPage({ currentUser }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false });
  const [setup, setSetup] = useState(null);
  const [setupCode, setSetupCode] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await getMyProfile();
      if (!response.success) throw new Error(response.message || 'Unable to load account settings');
      setProfile(response.data);
    } catch (err) {
      setError(err.message || 'Unable to load account settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const initials = useMemo(() => {
    const name = profile?.name || currentUser?.name || profile?.email || 'Admin';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }, [profile, currentUser]);

  const passwordStrength = useMemo(() => {
    const value = passwords.next;
    return [value.length >= 8, /[A-Z]/.test(value), /[a-z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
  }, [passwords.next]);

  const run = async (action, successMessage) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await action();
      if (!response.success) throw new Error(response.message || 'Request failed');
      setMessage(successMessage);
      return response;
    } catch (err) {
      setError(err.message || 'Request failed');
      return null;
    } finally { setBusy(false); }
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    if (passwords.next.length < 8) return setError('New password must be at least 8 characters');
    if (passwords.next !== passwords.confirm) return setError('New passwords do not match');
    const response = await run(() => changeMyPassword(passwords.current, passwords.next), 'Password changed successfully.');
    if (response) setPasswords({ current: '', next: '', confirm: '' });
  };

  const beginTwoFactor = async () => {
    const response = await run(setupTwoFactor, 'Scan the QR code and confirm the 6-digit code.');
    if (response) setSetup(response.data);
  };

  const enableTwoFactor = async () => {
    const response = await run(() => confirmTwoFactor(setupCode), 'Two-factor authentication enabled.');
    if (response) { setSetup(null); setSetupCode(''); await loadProfile(); }
  };

  const turnOffTwoFactor = async () => {
    const response = await run(() => disableTwoFactor(disableCode), 'Two-factor authentication disabled.');
    if (response) { setDisableCode(''); await loadProfile(); }
  };

  if (loading) return <GreetoLoader fullScreen label="Loading settings..." sublabel="Fetching admin account and security" />;

  return (
    <div className="min-h-full bg-[#f4f1fb] p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-500">Account</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Settings</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">Manage your admin profile, password, and sign-in protection.</p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black ${profile?.twoFactorEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {profile?.twoFactorEnabled ? <ShieldCheck size={15} /> : <ShieldOff size={15} />}
            2FA {profile?.twoFactorEnabled ? 'ACTIVE' : 'DISABLED'}
          </span>
        </div>

        {(error || message) && <div className={`mb-5 rounded-xl border px-4 py-3 text-sm font-bold ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-sm">
              <div className="bg-gradient-to-br from-[#9200cc] to-[#3a0670] p-7 text-white">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-xl font-black">{initials}</div>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-black">{profile?.name || 'Admin User'}</h2>
                    <p className="mt-1 truncate text-sm text-purple-100">{profile?.email}</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-3">
                {[
                  [UserRound, 'Role', profile?.role || 'admin'],
                  [Mail, 'Email', profile?.email || '-'],
                  [CheckCircle2, 'Status', profile?.active ? 'Active' : 'Inactive'],
                ].map(([Icon, label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><Icon size={17} className="text-purple-600" /><p className="mt-3 text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 truncate text-sm font-black capitalize text-slate-900">{value}</p></div>)}
              </div>
            </section>

            <section className="rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Security Overview</h2>
              <div className="mt-5 divide-y divide-slate-100">
                {[
                  [KeyRound, 'Password', 'Managed internally', true],
                  [ShieldCheck, 'Two-factor authentication', profile?.twoFactorEnabled ? 'Enabled' : 'Not enabled', profile?.twoFactorEnabled],
                  [CheckCircle2, 'Account', profile?.active ? 'Active' : 'Inactive', profile?.active],
                ].map(([Icon, title, value, ok]) => <div key={title} className="flex items-center justify-between gap-4 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><Icon size={18} /></div><div><p className="text-sm font-black text-slate-900">{title}</p><p className="text-xs font-semibold text-slate-500">{value}</p></div></div><span className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-400'}`} /></div>)}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <form onSubmit={submitPassword} className="rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><KeyRound size={20} /></div><div><h2 className="text-lg font-black text-slate-950">Change Password</h2><p className="text-xs font-semibold text-slate-500">Use a strong password you do not reuse elsewhere.</p></div></div>
              <div className="mt-6 space-y-4">
                <PasswordField label="Current password" value={passwords.current} onChange={(value) => setPasswords({ ...passwords, current: value })} visible={visible.current} onToggle={() => setVisible({ ...visible, current: !visible.current })} autoComplete="current-password" />
                <PasswordField label="New password" value={passwords.next} onChange={(value) => setPasswords({ ...passwords, next: value })} visible={visible.next} onToggle={() => setVisible({ ...visible, next: !visible.next })} autoComplete="new-password" />
                <div className="grid grid-cols-5 gap-2">{[1,2,3,4,5].map((level) => <span key={level} className={`h-1.5 rounded-full ${passwordStrength >= level ? 'bg-purple-600' : 'bg-slate-100'}`} />)}</div>
                <PasswordField label="Confirm new password" value={passwords.confirm} onChange={(value) => setPasswords({ ...passwords, confirm: value })} visible={visible.confirm} onToggle={() => setVisible({ ...visible, confirm: !visible.confirm })} autoComplete="new-password" />
                <button disabled={busy || !passwords.current || !passwords.next || !passwords.confirm} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#9200cc] to-[#3a0670] text-sm font-black text-white shadow-lg disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={17} /> : <LockKeyhole size={17} />} Update Password</button>
              </div>
            </form>

            <section className="rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3"><div className={`flex h-11 w-11 items-center justify-center rounded-xl ${profile?.twoFactorEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{profile?.twoFactorEnabled ? <ShieldCheck size={20} /> : <ShieldOff size={20} />}</div><div><h2 className="text-lg font-black text-slate-950">Two-Factor Authentication</h2><p className="text-xs font-semibold text-slate-500">Protect this admin account with an authenticator app.</p></div></div>
              {!profile?.twoFactorEnabled && !setup && <button type="button" onClick={beginTwoFactor} disabled={busy} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-black text-white disabled:opacity-50"><LockKeyhole size={17} /> Enable 2FA</button>}
              {setup && <div className="mt-5 space-y-4"><div className="mx-auto flex w-fit rounded-2xl border border-slate-100 bg-white p-4 shadow-inner"><QRCode value={setup.otpauthUrl || setup.secret || ''} size={164} /></div><p className="text-center text-sm font-semibold text-slate-500">Scan the QR code with your authenticator app.</p><div className="flex items-center gap-2 rounded-xl bg-purple-50 p-3"><code className="min-w-0 flex-1 break-all text-xs font-black text-slate-800">{setup.secret}</code><button type="button" onClick={() => navigator.clipboard?.writeText(setup.secret)} className="rounded-lg p-2 text-purple-700 hover:bg-white"><Copy size={15} /></button></div><input value={setupCode} onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className={`${fieldClass} text-center text-lg tracking-[0.3em]`} /><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setSetup(null)} className="h-11 rounded-xl border border-slate-200 text-sm font-black text-slate-600">Cancel</button><button type="button" onClick={enableTwoFactor} disabled={busy || setupCode.length !== 6} className="h-11 rounded-xl bg-purple-600 text-sm font-black text-white disabled:opacity-50">Confirm</button></div></div>}
              {profile?.twoFactorEnabled && <div className="mt-5 space-y-3"><p className="text-sm font-medium text-slate-500">Enter a current authenticator code to disable 2FA.</p><input value={disableCode} onChange={(event) => setDisableCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className={`${fieldClass} text-center text-lg tracking-[0.3em]`} /><button type="button" onClick={turnOffTwoFactor} disabled={busy || disableCode.length !== 6} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 text-sm font-black text-red-600 disabled:opacity-50"><X size={16} /> Disable 2FA</button></div>}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
