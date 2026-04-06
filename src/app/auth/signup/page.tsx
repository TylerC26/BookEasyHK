'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { I18nProvider, useI18n } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/language-toggle';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';

function SignupForm() {
  const { t, locale } = useI18n();
  const zh = locale === 'zh-HK';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPwd) {
      setError(zh ? '兩次密碼不一致' : 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError(zh ? '密碼最少需要6個字符' : 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-[#CCFBF1] flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">📧</span>
          </div>
          <h2 className="text-2xl font-semibold text-[#111111] mb-2">{t('signupSuccess')}</h2>
          <p className="text-sm text-[#6B7280] mb-6">
            {zh ? '請查看你的電郵，點擊驗證連結後繼續。' : 'Please check your email and click the verification link to continue.'}
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#0F766E] rounded-lg hover:bg-[#0D9488] transition-colors"
          >
            {t('login')} <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  const perks = zh
    ? ['免費試用 14 天', '無需信用卡', '30秒完成設定', '隨時取消']
    : ['14-day free trial', 'No credit card', '30-second setup', 'Cancel anytime'];

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#111111] flex-col items-center justify-center px-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-[#0F766E]/8 -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-[#0F766E]/8 translate-y-1/3 -translate-x-1/3" />
        <div className="relative z-10 space-y-8 max-w-sm">
          <div className="font-display text-5xl font-light text-white leading-tight">
            {zh ? '即刻開始,\n免費試用。' : 'Start today,\nfree trial.'}
          </div>
          <ul className="space-y-3">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-3 text-white/70 text-sm">
                <div className="w-5 h-5 rounded-full bg-[#0F766E] flex items-center justify-center flex-shrink-0">
                  <Check size={11} className="text-white" />
                </div>
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm mb-10">
          <Link href="/" className="font-display text-xl font-light text-[#111111]">
            BookEasy<span className="text-[#0F766E]">.</span>
          </Link>
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-[#111111] mb-1">
            {zh ? '建立帳號' : 'Create your account'}
          </h1>
          <p className="text-sm text-[#6B7280] mb-8">
            {zh ? '免費開始，無需信用卡。' : 'Start for free, no credit card required.'}
          </p>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#3D3D3D] mb-1.5">{t('email')}</label>
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
              <label className="block text-xs font-medium text-[#3D3D3D] mb-1.5">{t('password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 text-sm border border-[#E5E7EB] rounded-lg bg-white text-[#111111] placeholder-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#3D3D3D] mb-1.5">{t('confirmPassword')}</label>
              <input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
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
              className="w-full py-2.5 px-4 bg-[#0F766E] text-white text-sm font-medium rounded-lg hover:bg-[#0D9488] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (zh ? '建立中⋯' : 'Creating account…') : (zh ? '免費建立帳號' : 'Create free account')}
            </button>
          </form>

          <p className="text-xs text-center text-[#9CA3AF] mt-4">
            {zh ? '建立帳號即代表同意我們的服務條款及私隱政策' : 'By signing up, you agree to our Terms of Service and Privacy Policy'}
          </p>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#E5E7EB]" />
          </div>

          <p className="text-sm text-center text-[#6B7280]">
            {t('hasAccount')}{' '}
            <Link href="/auth/login" className="text-[#0F766E] font-medium hover:underline">
              {t('login')}
            </Link>
          </p>
        </div>

        <div className="mt-8">
          <LanguageToggle />
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <I18nProvider>
      <SignupForm />
    </I18nProvider>
  );
}
