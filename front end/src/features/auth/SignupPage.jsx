import { useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react';
import { registerWorkspace } from './api.js';

export default function SignupPage() {
  const [form, setForm] = useState({ workspaceName: '', name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const result = await registerWorkspace(form);
      if (!result.success) setError(result.message || 'Could not create your workspace.');
      else {
        setDone(true);
      }
    } catch (err) {
      setError(err?.message || 'Could not create your workspace. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-[#f6f4fb] p-4 sm:p-8">
      <section className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden border border-violet-100 bg-white shadow-[0_24px_70px_rgba(51,25,100,0.12)] lg:grid-cols-[minmax(0,0.9fr)_minmax(440px,1.1fr)]">
        <aside className="hidden bg-[#191148] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center bg-[#8555ff] text-xl font-bold">G</span><div><b className="text-xl">Greeto</b><p className="text-xs text-violet-200">Workspace onboarding</p></div></div>
            <h1 className="mt-20 max-w-md text-4xl font-semibold leading-tight">Set up a workspace your whole team can use.</h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-violet-100/75">Your owner account, workspace, default organization and secure access are created together.</p>
          </div>
          <div className="space-y-4 border-t border-white/10 pt-7 text-sm text-violet-100/80">
            {['Create your workspace', 'Sign in to your owner account', 'Invite your team and connect channels'].map((item, index) => <div key={item} className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">{index + 1}</span>{item}</div>)}
          </div>
        </aside>
        <div className="flex items-center justify-center px-6 py-10 sm:px-12">
          <div className="w-full max-w-md">
            <a href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-violet-700"><ArrowLeft size={16} /> Back to sign in</a>
            {done ? <div className="mt-12"><CheckCircle2 size={42} className="text-emerald-500" /><h2 className="mt-5 text-3xl font-semibold text-slate-950">Workspace created</h2><p className="mt-3 text-sm leading-6 text-slate-600">Your owner account is ready. Sign in with the email and password you just created.</p><a href="/login" className="mt-8 inline-flex items-center gap-2 bg-[#6d3df5] px-5 py-3 text-sm font-semibold text-white hover:bg-[#5830d4]">Go to sign in <ArrowRight size={16} /></a></div> : <>
              <div className="mt-10"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">Start your workspace</p><h2 className="mt-3 text-3xl font-semibold text-slate-950">Create your Greeto account</h2><p className="mt-3 text-sm leading-6 text-slate-600">You will be the workspace owner and can invite teammates after setup.</p></div>
              <form onSubmit={submit} className="mt-8 space-y-4">
                <Field icon={Building2} label="Workspace name"><input required value={form.workspaceName} onChange={update('workspaceName')} placeholder="Acme Sales" className="auth-input" /></Field>
                <Field icon={UserRound} label="Your name"><input required value={form.name} onChange={update('name')} placeholder="Your full name" className="auth-input" /></Field>
                <Field icon={Mail} label="Work email"><input required type="email" value={form.email} onChange={update('email')} placeholder="you@company.com" className="auth-input" /></Field>
                <Field icon={Lock} label="Password"><div className="flex w-full items-center"><input required minLength="8" type={showPassword ? 'text' : 'password'} value={form.password} onChange={update('password')} placeholder="At least 8 characters" className="auth-input" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="-ml-9 text-slate-400">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></Field>
                <Field icon={Lock} label="Confirm password"><input required minLength="8" type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={update('confirmPassword')} placeholder="Re-enter your password" className="auth-input" /></Field>
                {error && <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 bg-[#6d3df5] text-sm font-semibold text-white transition hover:bg-[#5830d4] disabled:opacity-60">{loading ? 'Creating workspace...' : <>Create workspace <ArrowRight size={17} /></>}</button>
              </form>
            </>}
          </div>
        </div>
      </section>
      <style>{`.auth-input{width:100%;background:transparent;outline:none;font-size:14px;color:#172033}.auth-input::placeholder{color:#9aa4b2}`}</style>
    </main>
  );
}

function Field({ icon: Icon, label, children }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span><span className="flex h-12 items-center border border-slate-200 bg-white px-3 transition focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100"><Icon size={17} className="mr-2 shrink-0 text-slate-400" />{children}</span></label>;
}
