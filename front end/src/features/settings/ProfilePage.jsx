import React, { useEffect, useRef, useState } from 'react';
import { Briefcase, Camera, Check, Copy, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Mail, Phone, ShieldCheck, ShieldOff, Trash2, UserRound, X } from 'lucide-react';
import QRCode from 'react-qr-code';
import { changeMyPassword, confirmTwoFactor, disableTwoFactor, getMyProfile, setupTwoFactor, updateMyProfile } from './api.js';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';

function initials(profile) {
  const name = profile?.name || profile?.email || 'G';
  return String(name).trim().charAt(0).toUpperCase() || 'G';
}

function splitName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

function resizeImageToBase64(file, maxSize = 420, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
        {Icon ? <Icon size={13} /> : null}
        {label}
      </span>
      {children}
    </label>
  );
}

export default function ProfilePage({ currentUser, onProfileUpdated }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', jobTitle: '', countryCode: '', phoneNumber: '', avatarUrl: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [setup, setSetup] = useState(null);
  const [setupCode, setSetupCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [securityBusy, setSecurityBusy] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordVisible, setPasswordVisible] = useState({ current: false, next: false, confirm: false });
  const fileRef = useRef(null);

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getMyProfile();
      if (!res.success) throw new Error(res.message || 'Unable to load profile');
      const data = res.data;
      setProfile(data);
      setForm({
        firstName: data.firstName || splitName(data.name).firstName,
        lastName: data.lastName || splitName(data.name).lastName,
        jobTitle: data.jobTitle || '',
        countryCode: data.countryCode || '',
        phoneNumber: data.phoneNumber || '',
        avatarUrl: data.avatarUrl || null,
      });
    } catch (err) {
      setError(err.message || 'Unable to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const saveProfile = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const name = [form.firstName, form.lastName].filter(Boolean).join(' ').trim() || profile?.name || currentUser?.name;
      const res = await updateMyProfile({ ...form, name });
      if (!res.success) throw new Error(res.message || 'Profile save failed');
      setProfile(res.data);
      setEditing(false);
      setMessage('Profile updated successfully.');
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      const nextUser = { ...stored, name: res.data.name, email: res.data.email, attributes: { ...(stored.attributes || {}), profile: form } };
      localStorage.setItem('user', JSON.stringify(nextUser));
      onProfileUpdated?.(nextUser);
    } catch (err) {
      setError(err.message || 'Profile save failed');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setSaving(true);
    setError('');
    try {
      const avatarUrl = await resizeImageToBase64(file);
      const res = await updateMyProfile({ avatarUrl });
      if (!res.success) throw new Error(res.message || 'Avatar upload failed');
      setProfile(res.data);
      updateField('avatarUrl', res.data.avatarUrl);
      setMessage('Avatar updated.');
    } catch (err) {
      setError(err.message || 'Avatar upload failed');
    } finally {
      setSaving(false);
    }
  };

  const removeAvatar = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await updateMyProfile({ avatarUrl: null });
      if (!res.success) throw new Error(res.message || 'Avatar removal failed');
      setProfile(res.data);
      updateField('avatarUrl', null);
      setMessage('Avatar removed.');
    } catch (err) {
      setError(err.message || 'Avatar removal failed');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (passwords.next.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setError('New passwords do not match.');
      return;
    }
    setSecurityBusy(true);
    try {
      const res = await changeMyPassword(passwords.current, passwords.next);
      if (!res.success) throw new Error(res.message || 'Password change failed');
      setPasswords({ current: '', next: '', confirm: '' });
      setMessage('Password changed successfully.');
    } catch (err) {
      setError(err.message || 'Password change failed');
    } finally {
      setSecurityBusy(false);
    }
  };

  const startSetup = async () => {
    setSecurityBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await setupTwoFactor();
      if (!res.success) throw new Error(res.message || 'Could not start 2FA setup');
      setSetup(res.data);
      setSetupCode('');
    } catch (err) {
      setError(err.message || 'Could not start 2FA setup');
    } finally {
      setSecurityBusy(false);
    }
  };

  const confirmSetup = async () => {
    setSecurityBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await confirmTwoFactor(setupCode);
      if (!res.success) throw new Error(res.message || 'Invalid authenticator code');
      setSetup(null);
      setSetupCode('');
      setMessage('Two-factor authentication enabled.');
      await loadProfile();
    } catch (err) {
      setError(err.message || 'Invalid authenticator code');
    } finally {
      setSecurityBusy(false);
    }
  };

  const disableSetup = async () => {
    setSecurityBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await disableTwoFactor(disableCode);
      if (!res.success) throw new Error(res.message || 'Invalid authenticator code');
      setDisableCode('');
      setMessage('Two-factor authentication disabled.');
      await loadProfile();
    } catch (err) {
      setError(err.message || 'Invalid authenticator code');
    } finally {
      setSecurityBusy(false);
    }
  };

  if (loading) {
    return (
      <GreetoLoader fullScreen label="Loading profile..." sublabel="Fetching account and security settings" />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f3fb]">
      <div className="border-b border-purple-100 bg-white/95 px-8 py-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-purple-500">Account</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Profile Settings</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Manage your identity, contact details, and login security.</p>
      </div>

      <div className="mx-auto grid max-w-[1380px] gap-6 p-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="space-y-6">
          {(message || error) && (
            <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${error ? 'border-red-100 bg-red-50 text-red-600' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
              {error || message}
            </div>
          )}

          <section className="rounded-[28px] border border-purple-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[30px] bg-gradient-to-br from-purple-600 to-fuchsia-500 text-3xl font-black text-white shadow-xl shadow-purple-500/20">
                    {form.avatarUrl ? <img src={form.avatarUrl} alt="Profile" className="h-full w-full object-cover" /> : initials(profile)}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-2xl border-2 border-white bg-slate-950 text-white shadow-lg"
                    title="Change avatar"
                  >
                    <Camera size={15} />
                  </button>
                  {form.avatarUrl && (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      disabled={saving}
                      className="absolute -bottom-2 left-0 flex h-9 w-9 items-center justify-center rounded-2xl border-2 border-white bg-red-50 text-red-600 shadow-lg disabled:opacity-60"
                      title="Remove avatar"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-950">{profile?.name || currentUser?.name || 'Greeto User'}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{profile?.email}</p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Active account
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing((value) => !value)}
                className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-2.5 text-sm font-black text-purple-700 hover:bg-purple-100"
              >
                {editing ? 'Cancel Edit' : 'Edit Profile'}
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-purple-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">Personal Information</h2>
                <p className="text-sm font-medium text-slate-500">These details are used across inbox, assignment, and team views.</p>
              </div>
              {editing && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveProfile}
                  className="flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-purple-950 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Save Changes
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="First name" icon={UserRound}>
                <input disabled={!editing} value={form.firstName} onChange={(e) => updateField('firstName', e.target.value)} className="w-full rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-purple-100 disabled:bg-slate-50 disabled:text-slate-500" />
              </Field>
              <Field label="Last name" icon={UserRound}>
                <input disabled={!editing} value={form.lastName} onChange={(e) => updateField('lastName', e.target.value)} className="w-full rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-purple-100 disabled:bg-slate-50 disabled:text-slate-500" />
              </Field>
              <Field label="Email" icon={Mail}>
                <input disabled value={profile?.email || ''} className="w-full rounded-2xl border border-purple-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500" />
              </Field>
              <Field label="Job title" icon={Briefcase}>
                <input disabled={!editing} value={form.jobTitle} onChange={(e) => updateField('jobTitle', e.target.value)} placeholder="Support Manager" className="w-full rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-purple-100 disabled:bg-slate-50 disabled:text-slate-500" />
              </Field>
              <Field label="Country code" icon={Phone}>
                <input disabled={!editing} value={form.countryCode} onChange={(e) => updateField('countryCode', e.target.value)} placeholder="+91" className="w-full rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-purple-100 disabled:bg-slate-50 disabled:text-slate-500" />
              </Field>
              <Field label="Phone number" icon={Phone}>
                <input disabled={!editing} value={form.phoneNumber} onChange={(e) => updateField('phoneNumber', e.target.value)} placeholder="9876543210" className="w-full rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-purple-100 disabled:bg-slate-50 disabled:text-slate-500" />
              </Field>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <form onSubmit={changePassword} className="rounded-[28px] border border-purple-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                <KeyRound size={21} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-950">Change Password</h2>
                <p className="text-xs font-semibold text-slate-500">Update the password used for this account.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ['current', 'Current password', 'current-password'],
                ['next', 'New password', 'new-password'],
                ['confirm', 'Confirm new password', 'new-password'],
              ].map(([key, placeholder, autoComplete]) => (
                <div key={key} className="relative">
                  <input
                    type={passwordVisible[key] ? 'text' : 'password'}
                    value={passwords[key]}
                    onChange={(event) => setPasswords((prev) => ({ ...prev, [key]: event.target.value }))}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    className="h-12 w-full rounded-2xl border border-purple-100 bg-white px-4 pr-12 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-purple-100"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-purple-50 hover:text-purple-700"
                    aria-label={passwordVisible[key] ? `Hide ${placeholder}` : `Show ${placeholder}`}
                  >
                    {passwordVisible[key] ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              ))}
              <button
                type="submit"
                disabled={securityBusy || !passwords.current || !passwords.next || !passwords.confirm}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-black text-white disabled:opacity-50"
              >
                {securityBusy ? <Loader2 size={16} className="animate-spin" /> : <LockKeyhole size={16} />}
                Update Password
              </button>
            </div>
          </form>

          <section className="rounded-[28px] border border-purple-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${profile?.twoFactorEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {profile?.twoFactorEnabled ? <ShieldCheck size={22} /> : <ShieldOff size={22} />}
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-950">Two-Factor Authentication</h2>
                <p className="text-xs font-semibold text-slate-500">{profile?.twoFactorEnabled ? 'Enabled for this login' : 'Authenticator app not enabled'}</p>
              </div>
            </div>

            {!profile?.twoFactorEnabled && !setup && (
              <button
                type="button"
                onClick={startSetup}
                disabled={securityBusy}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#9200cc] to-[#34075a] px-4 py-3 text-sm font-black text-white shadow-lg disabled:opacity-60"
              >
                {securityBusy ? <Loader2 size={16} className="animate-spin" /> : <LockKeyhole size={16} />}
                Enable 2FA
              </button>
            )}

            {setup && (
              <div className="mt-5 space-y-4">
                <div className="rounded-3xl border border-purple-100 bg-white p-5 text-center shadow-sm">
                  <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-3xl border border-slate-100 bg-white p-4 shadow-inner">
                    <QRCode value={setup.otpauthUrl || setup.secret || ''} size={176} />
                  </div>
                  <p className="mt-4 text-sm font-black text-slate-950">Scan this QR code</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    Open Google Authenticator, Microsoft Authenticator, or 1Password and scan this code.
                  </p>
                </div>
                <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-500">Manual key</p>
                  <div className="mt-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2">
                    <code className="min-w-0 flex-1 break-all text-xs font-black text-slate-900">{setup.secret}</code>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(setup.secret)} className="rounded-lg p-2 text-purple-700 hover:bg-purple-50">
                      <Copy size={14} />
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">Add this key in Google Authenticator, Microsoft Authenticator, or 1Password, then enter the 6-digit code below.</p>
                </div>
                <input value={setupCode} onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} placeholder="000000" className="w-full rounded-2xl border border-purple-100 px-4 py-3 text-center text-xl font-black tracking-[0.3em] outline-none focus:ring-2 focus:ring-purple-100" />
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setSetup(null)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600">Cancel</button>
                  <button type="button" disabled={setupCode.length !== 6 || securityBusy} onClick={confirmSetup} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-60">Confirm</button>
                </div>
              </div>
            )}

            {profile?.twoFactorEnabled && (
              <div className="mt-5 space-y-3">
                <p className="text-sm leading-6 text-slate-500">Next login will require a fresh 6-digit authenticator code.</p>
                <input value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} placeholder="Code to disable" className="w-full rounded-2xl border border-red-100 px-4 py-3 text-center text-lg font-black tracking-[0.25em] outline-none focus:ring-2 focus:ring-red-100" />
                <button type="button" disabled={disableCode.length !== 6 || securityBusy} onClick={disableSetup} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-red-600 disabled:opacity-60">
                  {securityBusy ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                  Disable 2FA
                </button>
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-purple-100 bg-gradient-to-br from-[#9200cc] to-[#34075a] p-6 text-white shadow-xl shadow-purple-500/20">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-100">Session</p>
            <p className="mt-3 text-2xl font-black">{profile?.role || currentUser?.role || 'agent'}</p>
            <p className="mt-2 text-sm text-purple-100">Team access and permissions are controlled by your assigned team role.</p>
            <div className="mt-4 rounded-2xl bg-white/10 p-3 text-xs font-bold text-purple-50">
              Team: {profile?.teamId || currentUser?.teamId || 'Default'}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
