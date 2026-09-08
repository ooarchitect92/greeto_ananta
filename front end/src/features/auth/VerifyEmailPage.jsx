import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MailWarning, XCircle } from 'lucide-react';
import { verifyEmail } from './api.js';

export default function VerifyEmailPage() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [state, setState] = useState(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? 'Verifying your email...' : 'This verification link is missing its token.');
  useEffect(() => { if (!token) return; verifyEmail(token).then((res) => { setState(res.success ? 'success' : 'error'); setMessage(res.message || 'Could not verify this email.'); }).catch((err) => { setState('error'); setMessage(err?.message || 'Could not verify this email.'); }); }, [token]);
  const Icon = state === 'success' ? CheckCircle2 : state === 'loading' ? Loader2 : XCircle;
  return <AuthNotice icon={<Icon size={40} className={`${state === 'success' ? 'text-emerald-500' : state === 'loading' ? 'animate-spin text-violet-600' : 'text-red-500'}`} />} title={state === 'success' ? 'Email verified' : state === 'loading' ? 'Verifying email' : 'Verification failed'} message={message} action={state === 'success' ? { href: '/login', label: 'Sign in to your workspace' } : { href: '/signup', label: 'Create a workspace' }} />;
}

export function AuthNotice({ icon, title, message, action }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f6f4fb] p-5"><section className="w-full max-w-md border border-violet-100 bg-white p-9 text-center shadow-[0_24px_70px_rgba(51,25,100,0.12)]"><div className="flex justify-center">{icon}</div><h1 className="mt-5 text-2xl font-semibold text-slate-950">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>{action && <a href={action.href} className="mt-7 inline-flex bg-[#6d3df5] px-5 py-3 text-sm font-semibold text-white hover:bg-[#5830d4]">{action.label}</a>}</section></main>;
}
