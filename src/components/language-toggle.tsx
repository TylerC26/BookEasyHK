'use client';

import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <button
      onClick={() => setLocale(locale === 'zh-HK' ? 'en' : 'zh-HK')}
      className={cn(
        'px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-white hover:bg-slate-50 transition-colors cursor-pointer',
        className
      )}
      aria-label="Toggle language"
    >
      {locale === 'zh-HK' ? 'EN' : '繁中'}
    </button>
  );
}
