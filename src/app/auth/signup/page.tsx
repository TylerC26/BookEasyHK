'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { I18nProvider, useI18n } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/language-toggle';
import Link from 'next/link';

function SignupForm() {
  const { t } = useI18n();
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
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
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
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <Card className="w-full max-w-md text-center">
          <div className="text-4xl mb-4">📧</div>
          <h2 className="text-xl font-semibold mb-2">{t('signupSuccess')}</h2>
          <p className="text-muted text-sm mb-4">
            Please check your email and click the verification link to continue.
          </p>
          <Link href="/auth/login">
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
          <p className="text-muted mt-2">{t('signup')}</p>
        </div>

        <Card>
          <form onSubmit={handleSignup} className="space-y-4">
            <Input
              id="email"
              label={t('email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hello@example.com"
              required
            />
            <Input
              id="password"
              label={t('password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <Input
              id="confirmPassword"
              label={t('confirmPassword')}
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder="••••••••"
              required
            />
            {error && (
              <p className="text-sm text-danger bg-red-50 p-3 rounded-lg">{error}</p>
            )}
            <Button type="submit" className="w-full" loading={loading}>
              {t('signup')}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-muted">
              {t('hasAccount')}{' '}
              <Link href="/auth/login" className="text-primary hover:underline font-medium">
                {t('login')}
              </Link>
            </p>
          </div>
        </Card>

        <div className="mt-4 flex justify-center">
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
