'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { I18nProvider, useI18n } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/language-toggle';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

function LoginForm() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const zh = locale === 'zh-HK';

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Inline signup state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(t('loginError'));
      setLoading(false);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');
    if (signupPassword.length < 6) {
      setSignupError(zh ? '密碼最少需要6個字符' : 'Password must be at least 6 characters');
      return;
    }
    setSignupLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (authError) {
      setSignupError(authError.message);
      setSignupLoading(false);
      return;
    }
    setSignupSuccess(true);
    setSignupLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] relative overflow-hidden flex items-center justify-center px-4 py-12">
      {/* Decorative circles */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-[#CCFBF1] opacity-70 pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-[#CCFBF1] opacity-60 pointer-events-none" />

      <div className="relative z-10 w-full max-w-3xl">
        {/* Language + logo row */}
        <div className="flex items-center justify-between mb-10">
          <Link href="/" className="font-display text-xl font-light text-[#111111]">
            BookEasy<span className="text-[#0F766E]">.</span>
          </Link>
          <LanguageToggle />
        </div>

        <div className="grid lg:grid-cols-[1fr_auto] gap-5 items-start">
          {/* ── LOGIN CARD ── */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-card">
            <h1 className="text-2xl font-semibold text-[#111111] mb-1">
              {zh ? '歡迎回來' : 'Welcome back'}
            </h1>
            <p className="text-sm text-[#6B7280] mb-7">
              {zh ? '登入你的商戶帳號' : 'Sign in to your business account'}
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#3D3D3D] mb-1.5">
                  {t('email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hello@example.com"
                  required
                  className="w-full px-3.5 py-2.5 text-sm border border-[#E5E7EB] rounded-lg bg-white text-[#111111] placeholder-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#3D3D3D]">
                    {t('password')}
                  </label>
                  <Link href="/auth/reset-password" className="text-xs text-[#0F766E] hover:underline">
                    {t('forgotPassword')}
                  </Link>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 text-sm border border-[#E5E7EB] rounded-lg bg-white text-[#111111] placeholder-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-colors"
                />
              </div>

              {error && (
                <div className="px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#0F766E] text-white text-sm font-medium rounded-lg hover:bg-[#0D9488] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              >
                {loading ? (zh ? '登入中⋯' : 'Signing in…') : t('login')}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[#E5E7EB]" />
              <span className="text-xs text-[#9CA3AF]">{zh ? '或' : 'or'}</span>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>

            {/* Google sign-in (UI only) */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-[#E5E7EB] rounded-lg text-sm text-[#3D3D3D] hover:border-[#0F766E] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {zh ? 'Google 登入' : 'Continue with Google'}
            </button>

            <p className="text-sm text-center text-[#6B7280] mt-5">
              {t('noAccount')}{' '}
              <Link href="/auth/signup" className="text-[#0F766E] font-medium hover:underline">
                {t('signup')}
              </Link>
            </p>
          </div>

          {/* ── SIGNUP CARD (desktop) ── */}
          {signupSuccess ? (
            <div className="hidden lg:block bg-white border border-[#E5E7EB] rounded-2xl p-7 shadow-card w-64">
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-[#CCFBF1] flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl">📧</span>
                </div>
                <p className="text-sm font-medium text-[#111111] mb-1">{t('signupSuccess')}</p>
                <p className="text-xs text-[#6B7280]">
                  {zh ? '請查看電郵驗證連結' : 'Check your email to verify'}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="hidden lg:block bg-white border border-[#E5E7EB] rounded-2xl p-7 shadow-card w-64 space-y-3">
              <div>
                <h2 className="text-base font-semibold text-[#111111]">
                  {zh ? '建立帳號' : 'Create account'}
                </h2>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  {zh ? '為你的業務建立商戶帳號' : 'Create your business account'}
                </p>
              </div>

              {[
                { label: zh ? '姓名' : 'Name', value: signupName, set: setSignupName, type: 'text', placeholder: zh ? '你的姓名' : 'Your name' },
                { label: t('email'), value: signupEmail, set: setSignupEmail, type: 'email', placeholder: 'hello@example.com' },
                { label: t('password'), value: signupPassword, set: setSignupPassword, type: 'password', placeholder: '••••••••' },
                { label: zh ? '電話' : 'Phone', value: signupPhone, set: setSignupPhone, type: 'tel', placeholder: '+852 9XXX XXXX' },
              ].map(({ label, value, set, type, placeholder }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-[#3D3D3D] mb-1">{label}</label>
                  <input
                    type={type}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder={placeholder}
                    required={type !== 'tel'}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-lg bg-white text-[#111111] placeholder-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-colors"
                  />
                </div>
              ))}

              {signupError && (
                <p className="text-xs text-red-500">{signupError}</p>
              )}

              <button
                type="submit"
                disabled={signupLoading}
                className="w-full py-2 px-3 bg-[#0F766E] text-white text-xs font-medium rounded-lg hover:bg-[#0D9488] transition-colors disabled:opacity-60 flex items-center justify-center gap-1"
              >
                {signupLoading ? (zh ? '建立中⋯' : 'Creating…') : (zh ? '建立帳號' : 'Create account')}
                {!signupLoading && <ArrowRight size={12} />}
              </button>

              <p className="text-[10px] text-center text-[#9CA3AF]">
                {zh ? '已有帳號？' : 'Already have an account?'}{' '}
                <button type="button" onClick={() => document.getElementById('login-email')?.focus()} className="text-[#0F766E]">
                  {zh ? '登入' : 'Sign in'}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <I18nProvider>
      <LoginForm />
    </I18nProvider>
  );
}
