'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { I18nProvider, useI18n } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/language-toggle';
import Link from 'next/link';

function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(t('loginError'));
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bookeasy-logo.svg" alt="BookEasy HK" className="h-12 w-auto mx-auto" />
          </Link>
          <p className="text-muted mt-2">{t('login')}</p>
        </div>

        <Card>
          <form onSubmit={handleLogin} className="space-y-4">
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
            {error && (
              <p className="text-sm text-danger bg-red-50 p-3 rounded-lg">{error}</p>
            )}
            <Button type="submit" className="w-full" loading={loading}>
              {t('login')}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <Link href="/auth/reset-password" className="text-sm text-primary hover:underline">
              {t('forgotPassword')}
            </Link>
            <p className="text-sm text-muted">
              {t('noAccount')}{' '}
              <Link href="/auth/signup" className="text-primary hover:underline font-medium">
                {t('signup')}
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

export default function LoginPage() {
  return (
    <I18nProvider>
      <LoginForm />
    </I18nProvider>
  );
}
