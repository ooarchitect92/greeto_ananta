import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, BarChart3, Bell, Building2, Eye, EyeOff, Facebook, Inbox, Instagram, Loader2, Lock, Mail, MessageCircleMore, Send, ShieldCheck, Smartphone, UserRound, UsersRound, Workflow, Zap } from 'lucide-react';
import { adminLogin, customerLogin, verifyTwoFactor, requestPasswordReset, resendVerification } from './api.js';

function RightSectionLogin({ isAdminMode = false }) {
  const sceneRef = useRef(null);
  const features = [
    {
      icon: MessageCircleMore,
      title: 'Unified inbox',
      text: 'All Conversations in one place',
      iconClass: 'bg-[#ECE8FF] text-[#5B3DF5]',
    },
    {
      icon: Zap,
      title: 'Real-Time Replies',
      text: 'Respond faster and close leads',
      iconClass: 'bg-[#E6FFF0] text-green-500',
    },
    {
      icon: BarChart3,
      title: 'Smarter Insights',
      text: 'Track performance and improve continuously',
      iconClass: 'bg-[#ECE8FF] text-[#5B3DF5]',
    },
  ];

  const handleSceneMove = (event) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const bounds = scene.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    scene.style.setProperty('--login-rotate-x', `${(-y * 7).toFixed(2)}deg`);
    scene.style.setProperty('--login-rotate-y', `${(x * 9).toFixed(2)}deg`);
  };

  const resetScene = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.style.setProperty('--login-rotate-x', '0deg');
    scene.style.setProperty('--login-rotate-y', '0deg');
  };

  return (
    <div className="login-showcase relative hidden flex-col items-center overflow-hidden p-8 text-white md:flex">
      <div className="login-showcase-content relative z-10 flex w-full max-w-[700px] flex-col items-center">
        <div className="login-showcase-heading max-w-xl text-center">
          <div className="login-showcase-kicker">
            <span />
            {isAdminMode ? 'Greeto operations' : 'Greeto command center'}
          </div>
          <h2 className="login-showcase-title font-semibold leading-tight">
            {isAdminMode ? 'Control every workspace.' : 'All your conversations.'}
          </h2>
          <p className="login-showcase-title mt-1 font-semibold text-[#A970FF]">
            {isAdminMode ? 'One secure command center.' : 'One powerful inbox.'}
          </p>
          <p className="login-showcase-copy mx-auto max-w-lg text-sm leading-6 text-violet-100/75">
            {isAdminMode
              ? 'Monitor workspaces, teams, integrations and operations from one secure place.'
              : 'Connect WhatsApp, Instagram, Email and more to manage, reply and grow your business.'}
          </p>
          {!isAdminMode && (
            <div className="login-capability-line" aria-label="Greeto capabilities">
              <span>Inbox</span><i />
              <span>Templates</span><i />
              <span>Workflows</span><i />
              <span>Campaigns</span>
            </div>
          )}
        </div>

        <div
          ref={sceneRef}
          className="login-visual-scene flex w-full max-w-[580px] items-center justify-center"
          onMouseMove={handleSceneMove}
          onMouseLeave={resetScene}
        >
          <div className="login-visual-plane">
            <div className="login-channel-orbit" aria-hidden="true" />

            <div className="login-channel login-channel-whatsapp" aria-label="WhatsApp"><MessageCircleMore size={28} /></div>
            <div className="login-channel login-channel-instagram" aria-label="Instagram"><Instagram size={27} /></div>
            <div className="login-channel login-channel-facebook" aria-label="Facebook"><Facebook size={27} /></div>
            <div className="login-channel login-channel-gmail" aria-label="Gmail"><span>M</span></div>
            <div className="login-channel login-channel-telegram" aria-label="Telegram"><Send size={25} /></div>
            <div className="login-channel login-channel-chat" aria-label="Chat"><MessageCircleMore size={25} /></div>

            <div className="login-dashboard-glow" aria-hidden="true" />
            <div className="login-mini-dashboard" aria-label="Greeto inbox preview">
              <div className="login-mini-topbar">
                <div className="login-mini-product"><span>G</span> Inbox</div>
                <div className="login-mini-live"><i /> Live</div>
              </div>
              <div className="login-mini-sidebar">
                {[Inbox, Bell, UserRound, Mail, BarChart3].map((Icon, index) => (
                  <div key={index} className={`login-mini-nav ${index === 0 ? 'is-active' : ''}`}>
                    <Icon size={12} />
                  </div>
                ))}
              </div>
              <div className="login-mini-contacts">
                <div className="login-mini-search">Search conversations</div>
                {[
                  ['AK', 'Aarav Kumar', 'Can you share details?', '2'],
                  ['PS', 'Priya Shah', 'Template delivered', ''],
                  ['RM', 'Rohan Mehta', 'Thank you!', '1'],
                  ['SK', 'Sara Khan', 'Interested in the plan', ''],
                ].map(([initials, name, preview, unread], item) => (
                  <div key={name} className={`login-mini-contact ${item === 0 ? 'is-selected' : ''}`}>
                    <span className="login-mini-avatar">{initials}</span>
                    <span className="login-mini-copy"><strong>{name}</strong><small>{preview}</small></span>
                    {unread && <b>{unread}</b>}
                  </div>
                ))}
              </div>
              <div className="login-mini-chat">
                <div className="login-mini-chat-user">
                  <span>AK</span>
                  <div><strong>Aarav Kumar</strong><small><i /> WhatsApp</small></div>
                  <b>Assigned</b>
                </div>
                <div className="login-mini-message is-gray">Hi, I would like to know more.</div>
                <div className="login-mini-message is-purple">Sure! I can help you with that.</div>
                <div className="login-mini-message is-purple is-second">Our team is available now.<small>Delivered</small></div>
                <div className="login-mini-composer"><span>Write a reply...</span><i><Send size={9} /></i></div>
              </div>
            </div>
          </div>
        </div>

        <div className="login-showcase-features grid w-full grid-cols-3 gap-5">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="login-feature-item flex min-h-[112px] flex-col items-center justify-center px-3 text-center"
                style={{ '--feature-delay': `${index * 120}ms` }}
              >
                <div className={`login-feature-icon mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${feature.iconClass}`}>
                  <Icon size={19} />
                </div>
                <h4 className="mb-1 text-[12px] font-semibold text-white">{feature.title}</h4>
                <p className="max-w-[150px] text-[10px] leading-4 text-violet-100/65">{feature.text}</p>
              </div>
            );
          })}
        </div>

        <div className="login-showcase-trust border-t border-white/10 px-10 text-center text-sm text-violet-100/70">
          Trusted by <span className="font-semibold text-[#A970FF]">500+</span> businesses to connect, engage and grow
        </div>
      </div>
    </div>
  );
}

export default function LoginPage({ onLogin, mode = 'customer' }) {
  const isAdminMode = mode === 'admin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendStatus, setResendStatus] = useState({ loading: false, message: '', isError: false });
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState({ loading: false, sent: false, error: '' });

  useEffect(() => {
    if (!isAdminMode) return;
    try {
      const savedEmail = localStorage.getItem('greeto.admin.rememberedEmail');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }
    } catch (_) {
      // Browser storage can be unavailable in privacy-restricted contexts.
    }
  }, [isAdminMode]);

  const persistAdminEmailPreference = () => {
    if (!isAdminMode) return;
    try {
      if (rememberEmail) localStorage.setItem('greeto.admin.rememberedEmail', email.trim());
      else localStorage.removeItem('greeto.admin.rememberedEmail');
    } catch (_) {
      // Successful sign-in must not depend on optional local preferences.
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotStatus({ loading: true, sent: false, error: '' });
    try {
      await requestPasswordReset(forgotEmail);
      setForgotStatus({ loading: false, sent: true, error: '' });
    } catch {
      setForgotStatus({ loading: false, sent: false, error: 'Something went wrong. Please try again.' });
    }
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotEmail('');
    setForgotStatus({ loading: false, sent: false, error: '' });
  };

  const handleResendVerification = async () => {
    const targetEmail = unverifiedEmail || email.trim();
    if (!targetEmail) return;

    setResendStatus({ loading: true, message: '', isError: false });
    try {
      const result = await resendVerification(targetEmail);
      if (!result.success) {
        setResendStatus({ loading: false, message: result.message || 'Could not send the verification email. Please try again.', isError: true });
        return;
      }
      setResendStatus({ loading: false, message: 'Verification email sent. Check your inbox and spam folder.', isError: false });
    } catch {
      setResendStatus({ loading: false, message: 'Could not send the verification email. Please try again.', isError: true });
    }
  };

  const finishLogin = async ({ accessToken, user: externalUser }) => {
    const decodeJwt = (tok) => {
      try {
        const parts = String(tok || '').split('.');
        if (parts.length < 2) return null;
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        return JSON.parse(decodeURIComponent(atob(padded).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
      } catch { return null; }
    };
    const decoded = decodeJwt(accessToken);
    const inferredTeamId =
      externalUser.teamId || externalUser.team_id ||
      (externalUser.team && (externalUser.team.id || externalUser.team._id)) ||
      (decoded && (decoded.teamId || decoded.team_id)) ||
      (decoded && Array.isArray(decoded.team_ids) && decoded.team_ids[0]) || null;
    const roleMap = { super_admin: 'super_admin', admin: 'admin', team_lead: 'supervisor', agent: 'agent', quality_manager: 'quality_manager' };
    const internalUser = {
      id: externalUser._id || externalUser.id,
      name: `${externalUser.firstname || ''} ${externalUser.lastname || ''}`.trim() || externalUser.name || externalUser.email,
      email: externalUser.email,
      role: roleMap[externalUser.role] || externalUser.role || 'agent',
      teamId: inferredTeamId || undefined,
      teamIds: inferredTeamId ? [inferredTeamId] : (Array.isArray(externalUser.teamIds) ? externalUser.teamIds : []),
      attributes: externalUser.attributes || {},
    };
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify(internalUser));
    onLogin(internalUser);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setUnverifiedEmail('');
    setResendStatus({ loading: false, message: '', isError: false });
    try {
      const res = await (isAdminMode ? adminLogin(email, password) : customerLogin(email, password));
      if (res.success) {
        persistAdminEmailPreference();
        if (res.data?.twoFactorRequired) {
          setMfaToken(res.data.mfaToken);
          setMfaCode('');
          return;
        }
        await finishLogin(res.data);
      } else {
        setError(res.message || 'Incorrect email or password. Please try again.');
        if (!isAdminMode && res.code === 'EMAIL_NOT_VERIFIED') {
          setUnverifiedEmail(email.trim());
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await verifyTwoFactor(mfaToken, mfaCode);
      if (!res.success) {
        setError(res.message || 'Invalid authenticator code.');
        return;
      }
      await finishLogin(res.data);
    } catch {
      setError('Could not verify 2FA code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div
        id="forgot-password-wrapper"
        className="fixed inset-0 z-50 flex select-none items-center justify-center overflow-y-auto bg-[#F8F9FD] p-4"
      >
        <div className="relative w-full max-w-md space-y-7 rounded-3xl border border-gray-200 bg-white p-8 shadow-2xl shadow-purple-100/70 sm:p-10">
          <div className="space-y-2 text-center">
            <span className="block text-4xl font-extrabold tracking-tight text-gray-900">
              Greet<span className="text-[#8B2CF5]">o</span>
            </span>
            <h2 className="mt-4 text-xl font-bold text-[#191c1f]">Reset your password</h2>
            <p className="mx-auto max-w-xs text-xs leading-relaxed text-slate-500">
              Enter your account email and we'll send you a link to reset your password.
            </p>
          </div>

          {forgotStatus.sent ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-center text-xs font-medium text-green-700">
                If that email is registered, a reset link has been sent. Check your inbox — the link expires in 30 minutes.
              </div>
              <button
                type="button"
                onClick={closeForgotPassword}
                className="w-full rounded-2xl bg-[#8B2CF5] py-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#6F00D2]"
              >
                Back to login
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="forgot-email" className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full rounded-2xl border border-transparent bg-[#F2F3F7]/50 py-3 pl-11 pr-4 text-xs font-medium text-gray-800 outline-none transition-all hover:bg-[#F2F3F7] focus:border-[#8B2CF5] focus:bg-white"
                  />
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              {forgotStatus.error && <p className="text-center text-xs font-medium text-red-500">{forgotStatus.error}</p>}

              <button
                type="submit"
                disabled={forgotStatus.loading}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#8B2CF5] py-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#6F00D2] disabled:bg-purple-300"
              >
                {forgotStatus.loading ? <Loader2 size={14} className="animate-spin" /> : <span>Send reset link</span>}
              </button>

              <button
                type="button"
                onClick={closeForgotPassword}
                className="w-full text-center text-[11px] text-gray-400 transition-colors hover:text-gray-600"
              >
                Back to login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (isAdminMode && mfaToken) {
    return (
      <div
        id="admin-login-wrapper"
        className="fixed inset-0 z-50 flex select-none items-center justify-center overflow-y-auto bg-[#F8F9FD] p-4"
      >
        <div className="relative w-full max-w-md space-y-7 rounded-3xl border border-gray-200 bg-white p-8 shadow-2xl shadow-purple-100/70 sm:p-10">
          <div className="space-y-2 text-center">
            <span className="block text-4xl font-extrabold tracking-tight text-gray-900">
              Greet<span className="text-[#8B2CF5]">o</span>
            </span>
            <h2 className="mt-4 text-xl font-bold text-[#191c1f]">
              {mfaToken ? 'Two-Factor Authentication' : 'Super Admin'}
            </h2>
            <p className="mx-auto max-w-xs text-xs leading-relaxed text-slate-500">
              {mfaToken
                ? 'Enter the 6-digit code from your authenticator app to verify your identity.'
                : 'Secure authentication for Greeto platform.'}
            </p>
          </div>

          {mfaToken ? (
            <form onSubmit={handleMfaSubmit} className="space-y-5">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2F3F7] text-[#8B2CF5]">
                  <Smartphone size={22} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="admin-mfa-code" className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Authenticator Code
                </label>
                <input
                  id="admin-mfa-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  className="h-14 w-full rounded-2xl border border-transparent bg-[#F2F3F7]/50 px-4 text-center text-lg font-bold tracking-[0.45em] text-gray-800 outline-none transition-all hover:bg-[#F2F3F7] focus:border-[#8B2CF5] focus:bg-white"
                />
              </div>

              {error && <p className="text-center text-xs font-medium text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading || mfaCode.length !== 6}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#8B2CF5] py-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#6F00D2] disabled:bg-purple-300"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <span>Verify Code</span>}
              </button>

              <button
                type="button"
                onClick={() => { setMfaToken(''); setMfaCode(''); setError(''); }}
                className="w-full text-center text-[11px] text-gray-400 transition-colors hover:text-gray-600"
              >
                Back to login
              </button>
            </form>
          ) : (
            <form id="admin-login-form" onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full rounded-2xl border border-transparent bg-[#F2F3F7]/50 py-3 pl-11 pr-4 text-xs font-medium text-gray-800 outline-none transition-all hover:bg-[#F2F3F7] focus:border-[#8B2CF5] focus:bg-white"
                  />
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { setForgotEmail(email); setShowForgotPassword(true); }}
                    className="text-[10px] font-bold text-[#8B2CF5] hover:text-[#3a0670]"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full rounded-2xl border border-transparent bg-[#F2F3F7]/50 py-3 pl-11 pr-11 text-xs font-medium text-gray-800 outline-none transition-all hover:bg-[#F2F3F7] focus:border-[#8B2CF5] focus:bg-white"
                  />
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex select-none items-center gap-2 py-1">
                <input
                  id="admin-checkbox-remember"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 text-[#8B2CF5] focus:ring-[#8B2CF5]"
                />
                <label htmlFor="admin-checkbox-remember" className="cursor-pointer text-xs font-medium text-gray-500">
                  Remember this session for 24 hours
                </label>
              </div>

              {error && <p className="text-center text-xs font-medium text-red-500">{error}</p>}

              <button
                id="admin-signin-submit-btn"
                type="submit"
                disabled={loading}
                className="group mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#8B2CF5] py-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#6F00D2] disabled:bg-purple-300"
              >
                {loading ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <span>Sign In to Greeto</span>
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (isAdminMode) {
    const adminCapabilities = [
      { icon: Building2, label: 'Workspace oversight', detail: 'Monitor tenant readiness and channel health.' },
      { icon: UsersRound, label: 'Team governance', detail: 'Manage roles, permissions and internal access.' },
      { icon: Workflow, label: 'Operations monitoring', detail: 'Review workflows, webhooks and failed actions.' },
    ];

    return (
      <div className="admin-login-shell min-h-screen bg-[#eef2f3] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1440px] overflow-hidden border border-[#dce5e3] bg-white shadow-[0_24px_70px_rgba(17,42,37,0.12)] sm:min-h-[calc(100vh-3rem)] lg:grid-cols-[minmax(420px,0.82fr)_minmax(540px,1.18fr)]">
          <section className="flex items-center justify-center px-6 py-10 sm:px-12 lg:px-16">
            <div className="w-full max-w-[440px]">
              <div className="mb-12 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center bg-[#142c27] text-lg font-bold text-white">G</div>
                <div>
                  <div className="text-xl font-semibold text-[#14201e]">Greeto Admin</div>
                  <div className="text-xs text-[#6c7d79]">Internal operations portal</div>
                </div>
              </div>

              <div className="mb-8">
                <div className="mb-4 inline-flex items-center gap-2 border border-[#cde8df] bg-[#edf8f4] px-3 py-1.5 text-xs font-semibold text-[#18735a]">
                  <ShieldCheck size={14} /> Authorized personnel only
                </div>
                <h1 className="text-3xl font-semibold text-[#14201e] sm:text-4xl">Sign in to operations</h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-[#697975]">
                  Access workspace management, security controls, integration health and platform audit tools.
                </p>
              </div>

              <form id="admin-login-form" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="admin-email" className="mb-2 block text-xs font-semibold text-[#344642]">Admin email</label>
                  <div className="flex h-12 items-center border border-[#ccd8d5] bg-white px-4 transition focus-within:border-[#16765b] focus-within:ring-2 focus-within:ring-[#16765b]/10">
                    <Mail size={17} className="shrink-0 text-[#7b8e89]" />
                    <input id="admin-email" name="email" autoComplete="username" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="ml-3 min-w-0 flex-1 bg-transparent text-sm text-[#14201e] outline-none placeholder:text-[#9aa8a5]" />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="admin-password" className="text-xs font-semibold text-[#344642]">Password</label>
                    <button type="button" onClick={() => { setForgotEmail(email); setShowForgotPassword(true); }} className="text-xs font-semibold text-[#16765b] hover:underline">Forgot password?</button>
                  </div>
                  <div className="flex h-12 items-center border border-[#ccd8d5] bg-white px-4 transition focus-within:border-[#16765b] focus-within:ring-2 focus-within:ring-[#16765b]/10">
                    <Lock size={17} className="shrink-0 text-[#7b8e89]" />
                    <input id="admin-password" name="password" autoComplete="current-password" type={showPass ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="ml-3 min-w-0 flex-1 bg-transparent text-sm text-[#14201e] outline-none placeholder:text-[#9aa8a5]" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="ml-2 text-[#7b8e89] hover:text-[#14201e]" aria-label={showPass ? 'Hide password' : 'Show password'}>{showPass ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-[#5f726e]">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(event) => setRememberEmail(event.target.checked)}
                    className="h-4 w-4 border-[#afc1bd] text-[#16765b] focus:ring-[#16765b]"
                  />
                  Remember my email on this device
                </label>

                {error && <div className="border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}

                <button id="admin-signin-submit-btn" type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 bg-[#142c27] text-sm font-semibold text-white transition hover:bg-[#0c211c] disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? <><Loader2 size={17} className="animate-spin" /> Signing in</> : <>Continue securely <ArrowRight size={17} /></>}
                </button>
              </form>

              <div className="mt-8 flex items-start gap-3 border-t border-[#e5ecea] pt-6 text-xs leading-5 text-[#71817d]">
                <Lock size={15} className="mt-0.5 shrink-0 text-[#16765b]" />
                Admin sessions are protected by role checks, audit logging and optional two-factor authentication.
              </div>
            </div>
          </section>

          <section className="relative hidden overflow-hidden bg-[#142c27] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
            <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
            <div className="relative z-10">
              <div className="mb-12 flex items-center justify-between border-b border-white/10 pb-6">
                <span className="text-xs font-semibold uppercase text-[#8ed7bf]">Platform control room</span>
                <span className="flex items-center gap-2 text-xs text-white/65"><i className="h-2 w-2 bg-[#4bd39d]" /> Secure access</span>
              </div>
              <h2 className="max-w-xl text-4xl font-semibold leading-tight xl:text-5xl">One place to keep every workspace healthy.</h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/65">Operational visibility across customers, conversations, teams, automations and connected providers.</p>
            </div>

            <div className="relative z-10 my-10 grid gap-3">
              {adminCapabilities.map(({ icon: Icon, label, detail }) => (
                <div key={label} className="grid grid-cols-[44px_1fr_auto] items-center gap-4 border border-white/10 bg-white/[0.055] p-4 transition hover:bg-white/[0.09]">
                  <div className="flex h-11 w-11 items-center justify-center bg-[#255247] text-[#8ed7bf]"><Icon size={20} /></div>
                  <div><div className="text-sm font-semibold">{label}</div><div className="mt-1 text-xs text-white/55">{detail}</div></div>
                  <Activity size={17} className="text-[#70cbaa]" />
                </div>
              ))}
            </div>

            <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-white/45">
              <span>Greeto internal administration</span>
              <span>Access is monitored</span>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen overflow-y-auto bg-[#f5f6f8] p-0 lg:h-screen lg:overflow-hidden lg:p-3">
      <div
        className="login-split-layout relative grid min-h-full w-full grid-cols-1 overflow-hidden bg-white shadow-[0_5px_30px_rgba(25,27,44,0.06)] lg:h-full lg:rounded-[15px]"
      >
        <div className="login-form-panel overflow-y-auto px-6 py-8 sm:px-10 lg:px-12 lg:py-10 xl:px-16">
          <div className="login-brand flex items-center gap-3">
            <div className="login-brand-mark flex h-12 w-12 items-center justify-center rounded-lg bg-[#6D3DF5] text-2xl font-black text-white">G</div>
            <div>
              <h1 className="text-2xl font-bold text-[#171A3A]">Greeto</h1>
              <p className="mt-0.5 text-xs font-medium text-[#8267C7]">One Inbox. Every Conversation.</p>
            </div>
          </div>

          <div className="login-form-content">
            <div className="mb-7">
              <div className="login-form-kicker">{isAdminMode ? 'Secure workspace' : 'Welcome to Greeto'}</div>
              <h2 className="login-form-title font-semibold text-[#171A3A]">
                {isAdminMode ? 'Admin access' : 'Welcome back'}
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
                {isAdminMode
                  ? 'Sign in securely to manage Greeto workspaces and platform operations.'
                  : 'Sign in to continue managing all your conversations in one place.'}
              </p>
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                {error}
              </div>
            )}

            {!isAdminMode && unverifiedEmail && (
              <div className="mb-4 rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-xs text-violet-900">
                <p className="font-medium">Did not receive the verification email?</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendStatus.loading}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#5B3DF5] transition hover:text-[#3f22c9] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resendStatus.loading && <Loader2 size={13} className="animate-spin" />}
                    {resendStatus.loading ? 'Sending...' : 'Resend verification email'}
                  </button>
                  {resendStatus.message && (
                    <span className={resendStatus.isError ? 'text-red-600' : 'text-emerald-700'}>{resendStatus.message}</span>
                  )}
                </div>
              </div>
            )}

          {mfaToken ? (
            <form onSubmit={handleMfaSubmit} className="space-y-4 pb-4">
              <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-4">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-purple-700 shadow-sm">
                  <ShieldCheck size={20} />
                </div>
                <h3 className="text-lg font-black text-slate-950">Two-factor authentication</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Enter the 6-digit code from your authenticator app to continue.
                </p>
              </div>

              <div>
                <label htmlFor="mfa-code" className="mb-1 block text-xs font-medium text-black sm:text-sm">Authenticator Code</label>
                <input
                  id="mfa-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  className="w-full rounded-xl border border-[#5B3DF5] bg-white px-4 py-3 text-center text-2xl font-black tracking-[0.35em] text-slate-950 outline-none transition focus:ring-2 focus:ring-[#C230FC]/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading || mfaCode.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-b from-[#C230FC] to-[#120324] py-2.5 text-sm font-medium text-white shadow-[0_10px_30px_rgba(194,48,252,0.25)] transition-all duration-300 hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>

              <button
                type="button"
                onClick={() => { setMfaToken(''); setMfaCode(''); setError(''); }}
                className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-50"
              >
                Back to login
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-3 pb-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-medium text-black sm:text-sm">Email</label>
              <div className="flex items-center rounded-lg border border-[#5B3DF5] px-3 py-2 transition focus-within:ring-2 focus-within:ring-[#C230FC]/20">
                <Mail size={18} className="text-gray-400" />
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="ml-2 w-full bg-transparent text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-medium text-black sm:text-sm">Password</label>
              <div className="flex items-center rounded-lg border border-gray-300 px-3 py-2 transition focus-within:border-[#5B3DF5] focus-within:ring-2 focus-within:ring-[#C230FC]/20">
                <Lock size={18} className="text-gray-400" />
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="ml-2 w-full bg-transparent text-sm outline-none"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="text-gray-400">
                  {showPass ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
              <div className="mt-1 text-right">
                <button
                  type="button"
                  onClick={() => { setForgotEmail(email); setShowForgotPassword(true); }}
                  className="text-sm font-medium text-[#5B3DF5] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-b from-[#C230FC] to-[#120324] py-2.5 text-sm font-medium text-white shadow-[0_10px_30px_rgba(194,48,252,0.25)] transition-all duration-300 hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? 'Signing in...' : (isAdminMode ? 'Sign In to Admin' : 'Sign In')}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-300" />
              <span className="text-xs text-gray-400">OR</span>
              <div className="h-px flex-1 bg-gray-300" />
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 py-2.5 text-sm transition hover:bg-gray-50"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="google" className="h-5 w-5" loading="lazy" decoding="async" />
              <span className="font-medium">Continue With Google</span>
            </button>

            {!isAdminMode && (
            <p className="mt-4 text-center text-xs text-gray-500 sm:text-sm">
              Don't have an account?{' '}
              <button type="button" onClick={() => { window.location.href = '/signup'; }} className="cursor-pointer font-semibold text-[#5B3DF5] hover:underline">
                Sign Up
              </button>
            </p>
            )}
          </form>
          )}
          </div>
        </div>

        <RightSectionLogin isAdminMode={isAdminMode} />
      </div>
    </div>
  );
}
