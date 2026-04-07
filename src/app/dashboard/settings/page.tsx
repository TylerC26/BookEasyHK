'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

type ThemePreference = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'bookeasy-theme-preference';

function applyTheme(theme: ThemePreference) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const [theme, setTheme] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(theme);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{locale === 'zh-HK' ? '網站設定' : 'Website Settings'}</h1>
        <Button onClick={handleSave} loading={saving}>
          <Save size={16} />
          {saved ? t('success') : t('save')}
        </Button>
      </div>

      <Card>
        <CardTitle className="mb-4">{locale === 'zh-HK' ? '外觀設定' : 'Appearance'}</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            id="theme-mode"
            label={locale === 'zh-HK' ? '主題模式' : 'Theme Mode'}
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemePreference)}
            options={[
              { value: 'system', label: locale === 'zh-HK' ? '跟隨系統' : 'System' },
              { value: 'light', label: locale === 'zh-HK' ? '淺色' : 'Light' },
              { value: 'dark', label: locale === 'zh-HK' ? '深色' : 'Dark' },
            ]}
          />
        </div>
        <p className="text-sm text-muted mt-3">
          {locale === 'zh-HK'
            ? '語言可在側邊欄底部切換。'
            : 'Language can be changed from the toggle at the bottom of the sidebar.'}
        </p>
      </Card>
    </div>
  );
}
