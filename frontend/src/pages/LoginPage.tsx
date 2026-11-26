import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { apiClient, extractErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post('/auth/login', { email: email.trim(), password });
      setSession(res.data.token, res.data.user);
      navigate(res.data.user.role === 'investigator' ? '/investigator' : '/dashboard');
    } catch (err) {
      setError(extractErrorMessage(err, 'Login failed. Please verify your credentials.'));
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (role: 'customer' | 'investigator') => {
    setError('');
    if (role === 'customer') {
      setEmail('customer@insureguard.ai');
      setPassword('Customer@123');
    } else {
      setEmail('investigator@insureguard.ai');
      setPassword('Investigator@123');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F4F7FB] via-white to-sky-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/60">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1E3D] text-sky-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-base font-bold text-[#0B1E3D]">VeriClaim AI</div>
            <div className="text-xs text-slate-500">Insurance Fraud Detection Portal</div>
          </div>
        </Link>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-[#0B1E3D]">Sign in to your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Access claim submissions, AI authenticity reports, or the SIU investigator queue.
        </p>

        {error && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Email Address
            </label>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Password
            </label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-11 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-2.5 rounded p-0.5 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#0B1E3D] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#143666] disabled:opacity-60"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Account Quick Fill */}
        <div className="mt-6 rounded-xl border border-sky-200 bg-sky-50/70 p-4">
          <div className="text-xs font-semibold text-[#0B1E3D]">Demo Accounts for Testing</div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillDemo('customer')}
              className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-[#0E2954] transition hover:bg-sky-100"
            >
              Fill Customer Demo
            </button>
            <button
              type="button"
              onClick={() => fillDemo('investigator')}
              className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-[#0E2954] transition hover:bg-sky-100"
            >
              Fill Investigator Demo
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          Need an account?{' '}
          <Link to="/register" className="font-semibold text-sky-600 hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
