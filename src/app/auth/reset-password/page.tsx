'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { I18nProvider, useI18n } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/language-toggle';
import Link from 'next/link';

function ResetForm() {
  const { t } = useI18n();
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
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <Card className="w-full max-w-md text-center">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-xl font-semibold mb-2">{t('resetSent')}</h2>
          <Link href="/auth/login" className="mt-4 inline-block">
            <Button variant="outline">{t('login')}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bookeasy-logo.svg" alt="BookEasy HK" className="h-12 w-auto mx-auto" />
          </Link>
          <p className="text-muted mt-2">{t('resetPassword')}</p>
        </div>

        <Card>
          <form onSubmit={handleReset} className="space-y-4">
            <Input
              id="email"
              label={t('email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hello@example.com"
              required
            />
            {error && (
              <p className="text-sm text-danger bg-red-50 p-3 rounded-lg">{error}</p>
            )}
            <Button type="submit" className="w-full" loading={loading}>
              {t('resetPassword')}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link href="/auth/login" className="text-sm text-primary hover:underline">
              {t('back')} {t('login')}
            </Link>
          </div>
        </Card>

        <div className="mt-4 flex justify-center">
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
