import { useState } from 'react';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { resetPassword } from './api.js';

export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await resetPassword(token, password);
      if (res.success) {
        setDone(true);
      } else {
        setError(res.message || 'This reset link is invalid or has expired.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="reset-password-wrapper"
      className="fixed inset-0 z-50 flex select-none items-center justify-center overflow-y-auto bg-[#F8F9FD] p-4"
    >
      <div className="relative w-full max-w-md space-y-7 rounded-3xl border border-gray-200 bg-white p-8 shadow-2xl shadow-purple-100/70 sm:p-10">
        <div className="space-y-2 text-center">
          <span className="block text-4xl font-extrabold tracking-tight text-gray-900">
            Greet<span className="text-[#8B2CF5]">o</span>
          </span>
          <h2 className="mt-4 text-xl font-bold text-[#191c1f]">Set a new password</h2>
        </div>

        {!token ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-center text-xs font-medium text-red-600">
            This reset link is missing its token. Please request a new one from the login page.
          </div>
        ) : done ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-center text-xs font-medium text-green-700">
              Your password has been updated. You can now log in.
            </div>
            <a
              href="/login"
              className="block w-full rounded-2xl bg-[#8B2CF5] py-3.5 text-center text-xs font-bold text-white shadow-sm transition-all hover:bg-[#6F00D2]"
            >
              Go to login
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-2xl border border-transparent bg-[#F2F3F7]/50 py-3 pl-11 pr-11 text-xs font-medium text-gray-800 outline-none transition-all hover:bg-[#F2F3F7] focus:border-[#8B2CF5] focus:bg-white"
                />
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPass ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showPass ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full rounded-2xl border border-transparent bg-[#F2F3F7]/50 py-3 pl-11 pr-4 text-xs font-medium text-gray-800 outline-none transition-all hover:bg-[#F2F3F7] focus:border-[#8B2CF5] focus:bg-white"
                />
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            {error && <p className="text-center text-xs font-medium text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#8B2CF5] py-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#6F00D2] disabled:bg-purple-300"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <span>Update password</span>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
