'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { I18nProvider, useI18n } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/language-toggle';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

function ResetForm() {
  const { t, locale } = useI18n();
  const zh = locale === 'zh-HK';
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-[#CCFBF1] flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">📬</span>
          </div>
          <h2 className="text-2xl font-semibold text-[#111111] mb-2">{t('resetSent')}</h2>
          <p className="text-sm text-[#6B7280] mb-6">
            {zh ? '請查看電郵，按照指示重設密碼。' : 'Check your email for password reset instructions.'}
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-sm text-[#0F766E] hover:underline"
          >
            <ArrowLeft size={14} /> {t('login')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10">
          <Link href="/" className="font-display text-xl font-light text-[#111111]">
            BookEasy<span className="text-[#0F766E]">.</span>
          </Link>
        </div>

        <h1 className="text-2xl font-semibold text-[#111111] mb-1">
          {zh ? '重設密碼' : 'Reset password'}
        </h1>
        <p className="text-sm text-[#6B7280] mb-8">
          {zh ? '輸入你的電郵，我們會發送重設連結。' : 'Enter your email and we\'ll send you a reset link.'}
        </p>

        <form onSubmit={handleReset} className="space-y-4">
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
            {loading ? (zh ? '發送中⋯' : 'Sending…') : t('resetPassword')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#0F766E] transition-colors"
          >
            <ArrowLeft size={13} />
            {t('back')} {t('login')}
          </Link>
        </div>

        <div className="mt-8 flex justify-center">
          <LanguageToggle />
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <I18nProvider>
      <ResetForm />
    </I18nProvider>
  );
}
