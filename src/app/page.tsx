'use client';

import { I18nProvider, useI18n } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/language-toggle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import {
  MessageSquare,
  Globe,
  Smartphone,
  Shield,
  Zap,
  Clock,
  Check,
  ArrowRight,
  Star,
} from 'lucide-react';

function LandingPage() {
  const { t, locale } = useI18n();

  const features = [
    { icon: Globe, title: t('feature1Title'), desc: t('feature1Desc'), color: 'bg-blue-50 text-blue-600' },
    { icon: MessageSquare, title: t('feature2Title'), desc: t('feature2Desc'), color: 'bg-green-50 text-green-600' },
    { icon: Smartphone, title: t('feature3Title'), desc: t('feature3Desc'), color: 'bg-purple-50 text-purple-600' },
    { icon: Shield, title: t('feature4Title'), desc: t('feature4Desc'), color: 'bg-amber-50 text-amber-600' },
    { icon: Zap, title: t('feature5Title'), desc: t('feature5Desc'), color: 'bg-rose-50 text-rose-600' },
    { icon: Clock, title: t('feature6Title'), desc: t('feature6Desc'), color: 'bg-teal-50 text-teal-600' },
  ];

  const starterFeatures = locale === 'zh-HK'
    ? ['1 位員工', '無限預約', 'WhatsApp 提醒', '繁體中文介面', '手機優先設計']
    : ['1 staff member', 'Unlimited bookings', 'WhatsApp reminders', 'Traditional Chinese UI', 'Mobile-first design'];

  const proFeatures = locale === 'zh-HK'
    ? ['最多 5 位員工', 'FPS/PayMe 訂金', '預約分析報告', '自訂提醒訊息', '優先支援']
    : ['Up to 5 staff', 'FPS/PayMe deposits', 'Booking analytics', 'Custom reminders', 'Priority support'];

  const proAiFeatures = locale === 'zh-HK'
    ? ['專業版所有功能', 'AI 預約助手', '智能時段建議', '自動重新安排', '24/7 WhatsApp 接待']
    : ['Everything in Pro', 'AI scheduling assistant', 'Smart slot suggestions', 'Auto rescheduling', '24/7 WhatsApp receptionist'];

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-primary">BookEasy HK</span>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">{t('login')}</Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm">{t('heroCta')}</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50" />
        <div className="relative max-w-6xl mx-auto px-4 py-24 lg:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-light text-primary text-sm font-medium mb-6">
              <Star size={14} />
              {locale === 'zh-HK' ? '免費試用 3 個月 · 毋須信用卡' : '3-month free trial · No credit card'}
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold text-secondary leading-tight mb-6">
              {t('heroTitle')}
            </h1>
            <p className="text-lg lg:text-xl text-muted leading-relaxed mb-8 max-w-2xl mx-auto">
              {t('heroSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup">
                <Button size="lg" className="text-base px-8">
                  {t('heroCta')} <ArrowRight size={18} />
                </Button>
              </Link>
              <a href="#features">
                <Button variant="outline" size="lg" className="text-base px-8">
                  {t('heroSecondaryCta')}
                </Button>
              </a>
            </div>

            {/* Social proof */}
            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-muted">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {['💅', '✂️', '🐾'].map((e, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm border-2 border-white">
                      {e}
                    </div>
                  ))}
                </div>
                <span>
                  {locale === 'zh-HK' ? '適用於美甲、髮型、寵物美容等' : 'For nails, hair, pet grooming & more'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-bg">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">{t('featuresTitle')}</h2>
          <p className="text-muted text-center mb-12 max-w-xl mx-auto">
            {locale === 'zh-HK'
              ? '專為香港小商戶量身打造，取代 WhatsApp 手動接單'
              : 'Purpose-built for HK small businesses, replacing manual WhatsApp bookings'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <Card key={i} className="hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                  <f.icon size={24} />
                </div>
                <h3 className="font-semibold text-secondary mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            {locale === 'zh-HK' ? '三步即可開始' : 'Get Started in 3 Steps'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: locale === 'zh-HK' ? '建立帳戶' : 'Create Account',
                desc: locale === 'zh-HK' ? '30 秒完成註冊，開始設定你的預約頁面。' : 'Sign up in 30 seconds and start setting up your booking page.',
                emoji: '📝',
              },
              {
                step: '2',
                title: locale === 'zh-HK' ? '新增服務' : 'Add Services',
                desc: locale === 'zh-HK' ? '輸入你的服務項目、價錢及營業時間。' : 'Enter your services, prices, and working hours.',
                emoji: '⚙️',
              },
              {
                step: '3',
                title: locale === 'zh-HK' ? '分享連結' : 'Share Your Link',
                desc: locale === 'zh-HK' ? '將預約連結分享到 WhatsApp 或印 QR code 貼在店門。' : 'Share your booking link on WhatsApp or print a QR code for your door.',
                emoji: '🔗',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 bg-primary-light rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
                  {item.emoji}
                </div>
                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold mb-3">
                  {item.step}
                </div>
                <h3 className="font-semibold text-secondary mb-2">{item.title}</h3>
                <p className="text-sm text-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-bg">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">{t('pricingTitle')}</h2>
          <p className="text-center text-muted mb-12">{t('freeTrial')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Starter */}
            <Card className="relative">
              <h3 className="font-semibold text-lg mb-1">{t('starterPlan')}</h3>
              <p className="text-sm text-muted mb-4">{t('starterDesc')}</p>
              <div className="mb-6">
                <span className="text-3xl font-bold">{t('starterPrice')}</span>
                <span className="text-muted">{t('perMonth')}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {starterFeatures.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check size={16} className="text-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup" className="block">
                <Button variant="outline" className="w-full">{t('getStarted')}</Button>
              </Link>
            </Card>

            {/* Pro */}
            <Card className="relative border-primary border-2 shadow-lg">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-white text-xs font-medium rounded-full">
                {locale === 'zh-HK' ? '最受歡迎' : 'Most Popular'}
              </div>
              <h3 className="font-semibold text-lg mb-1">{t('proPlan')}</h3>
              <p className="text-sm text-muted mb-4">{t('proDesc')}</p>
              <div className="mb-6">
                <span className="text-3xl font-bold">{t('proPrice')}</span>
                <span className="text-muted">{t('perMonth')}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {proFeatures.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check size={16} className="text-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup" className="block">
                <Button className="w-full">{t('getStarted')}</Button>
              </Link>
            </Card>

            {/* Pro + AI */}
            <Card className="relative">
              <h3 className="font-semibold text-lg mb-1">{t('proAiPlan')}</h3>
              <p className="text-sm text-muted mb-4">{t('proAiDesc')}</p>
              <div className="mb-6">
                <span className="text-3xl font-bold">{t('proAiPrice')}</span>
                <span className="text-muted">{t('perMonth')}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {proAiFeatures.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check size={16} className="text-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup" className="block">
                <Button variant="outline" className="w-full">{t('getStarted')}</Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-primary to-blue-700">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">
            {locale === 'zh-HK' ? '準備好告別 WhatsApp 接單混亂？' : 'Ready to stop managing bookings on WhatsApp?'}
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            {locale === 'zh-HK'
              ? '免費試用 3 個月，毋須信用卡。今日就開始。'
              : 'Free 3-month trial, no credit card required. Start today.'}
          </p>
          <Link href="/auth/signup">
            <Button size="lg" className="bg-white text-primary hover:bg-blue-50 text-base px-8">
              {t('heroCta')} <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary text-slate-400 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-white font-bold text-lg">BookEasy HK</span>
              <p className="text-sm mt-1">{t('footerTagline')}</p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="mailto:hello@bookeasyhk.com" className="hover:text-white transition-colors">
                hello@bookeasyhk.com
              </a>
              <span>© 2026 BookEasy HK</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <I18nProvider>
      <LandingPage />
    </I18nProvider>
  );
}
