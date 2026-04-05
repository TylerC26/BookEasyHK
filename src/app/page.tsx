'use client';

import { I18nProvider, useI18n } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/language-toggle';
import Link from 'next/link';
import Image from 'next/image';
import { Check, Menu, X } from 'lucide-react';
import { useState } from 'react';

function LandingPage() {
  const { t, locale } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const features = [
    {
      icon: 'language',
      title: t('feature1Title'),
      desc: t('feature1Desc'),
    },
    {
      icon: 'chat_bubble',
      title: t('feature2Title'),
      desc: t('feature2Desc'),
    },
    {
      icon: 'install_mobile',
      title: t('feature3Title'),
      desc: t('feature3Desc'),
    },
    {
      icon: 'event_busy',
      title: t('feature4Title'),
      desc: t('feature4Desc'),
    },
    {
      icon: 'smartphone',
      title: t('feature5Title'),
      desc: t('feature5Desc'),
    },
    {
      icon: 'timer',
      title: t('feature6Title'),
      desc: t('feature6Desc'),
    },
  ];

  const starterFeatures =
    locale === 'zh-HK'
      ? ['每月 50 個預約', '標準提醒']
      : ['Up to 50 bookings/mo', 'Standard Reminders'];

  const proFeatures =
    locale === 'zh-HK'
      ? ['無限預約', 'WhatsApp 提醒', '自訂品牌']
      : ['Unlimited bookings', 'WhatsApp Reminders', 'Custom Branding'];

  const proAiFeatures =
    locale === 'zh-HK'
      ? ['專業版所有功能', 'AI 預約助手', '智能容量分析']
      : ['Everything in Pro', 'AI Scheduling Assistant', 'Smart Capacity Analytics'];

  const steps = [
    {
      num: '1',
      title: locale === 'zh-HK' ? '建立帳戶' : 'Create Account',
      desc:
        locale === 'zh-HK'
          ? '以香港手機號碼或電郵數秒內完成註冊。'
          : 'Register with your HK mobile number or email in seconds.',
    },
    {
      num: '2',
      title: locale === 'zh-HK' ? '新增服務' : 'Add Services',
      desc:
        locale === 'zh-HK'
          ? '輸入你的服務項目、價錢及員工排班。'
          : 'Input your services, prices, and staff availability.',
    },
    {
      num: '3',
      title: locale === 'zh-HK' ? '分享連結' : 'Share Link',
      desc:
        locale === 'zh-HK'
          ? '將預約連結分享到 Instagram 簡介或 WhatsApp 狀態。'
          : 'Put your booking link in your Instagram bio or WhatsApp status.',
    },
  ];

  return (
    <div className="min-h-screen bg-bg text-on-surface">
      {/* Nav */}
      <nav className="bg-bg neomorph-raised sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-6 md:px-8 py-4 max-w-7xl mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bookeasy-logo.svg"
            alt="BookEasy HK"
            className="h-14 w-auto"
          />
          {/* Desktop nav links */}
          <div className="hidden md:flex gap-8 items-center">
            <a
              className="text-primary border-b-2 border-primary font-semibold py-1"
              href="#features"
            >
              {locale === 'zh-HK' ? '功能' : 'Features'}
            </a>
            <a
              className="text-muted hover:text-primary transition-colors py-1"
              href="#how-it-works"
            >
              {locale === 'zh-HK' ? '使用方法' : 'How it Works'}
            </a>
            <a
              className="text-muted hover:text-primary transition-colors py-1"
              href="#pricing"
            >
              {locale === 'zh-HK' ? '定價' : 'Pricing'}
            </a>
          </div>
          {/* Desktop auth buttons */}
          <div className="hidden md:flex gap-3 items-center">
            <LanguageToggle />
            <Link
              href="/auth/login"
              className="px-6 py-2 rounded-xl text-muted font-medium neomorph-hover transition-all active:scale-95 duration-200"
            >
              {t('login')}
            </Link>
            <Link
              href="/auth/signup"
              className="px-6 py-2 rounded-xl bg-surface neomorph-raised text-primary font-semibold neomorph-hover transition-all active:scale-95 duration-200"
            >
              {t('heroCta')}
            </Link>
          </div>
          {/* Mobile right side */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageToggle />
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-10 h-10 rounded-xl bg-surface neomorph-raised flex items-center justify-center text-primary"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="md:hidden px-6 pb-5 space-y-2 border-t border-outline-variant bg-[#d4d6dc]">
            <a
              href="#features"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-primary font-semibold neomorph-inset mt-4"
            >
              {locale === 'zh-HK' ? '功能' : 'Features'}
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-muted font-medium hover:text-primary transition-colors"
            >
              {locale === 'zh-HK' ? '使用方法' : 'How it Works'}
            </a>
            <a
              href="#pricing"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-muted font-medium hover:text-primary transition-colors"
            >
              {locale === 'zh-HK' ? '定價' : 'Pricing'}
            </a>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/auth/login"
                className="w-full py-3 rounded-xl text-center text-muted font-medium neomorph-inset"
              >
                {t('login')}
              </Link>
              <Link
                href="/auth/signup"
                className="w-full py-3 rounded-xl text-center bg-surface neomorph-raised text-primary font-semibold"
              >
                {t('heroCta')}
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main>
        {/* Hero */}
        <section className="max-w-7xl mx-auto px-8 py-24 flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2 space-y-8">
            <div className="inline-block px-4 py-1.5 rounded-full bg-surface neomorph-inset text-primary font-medium text-sm">
              {locale === 'zh-HK'
                ? '✨ 為香港中小企而設的 AI 排程'
                : '✨ AI-Powered Scheduling for HK SMBs'}
            </div>
            <h1 className="text-5xl lg:text-7xl font-semibold text-on-surface tracking-tight leading-tight">
              {locale === 'zh-HK' ? (
                <>
                  告別在{' '}
                  <span className="text-primary">WhatsApp</span>{' '}
                  接單混亂
                </>
              ) : (
                <>
                  Stop Managing Bookings on{' '}
                  <span className="text-primary">WhatsApp</span>
                </>
              )}
            </h1>
            <p className="text-xl text-on-surface-variant max-w-xl">
              {t('heroSubtitle')}
            </p>
            <div className="flex flex-wrap gap-6 pt-4">
              <Link
                href="/auth/signup"
                className="px-10 py-4 rounded-xl bg-surface neomorph-raised text-primary text-lg font-semibold neomorph-hover transition-all active:scale-95"
              >
                {t('heroCta')}
              </Link>
              <a
                href="#features"
                className="px-10 py-4 rounded-xl bg-surface neomorph-inset text-on-surface-variant text-lg font-medium"
              >
                {t('heroSecondaryCta')}
              </a>
            </div>
          </div>
          <div className="lg:w-1/2 w-full">
            <div className="p-4 rounded-3xl bg-surface neomorph-raised">
              <Image
                alt="Dashboard preview showing a clean calendar with booking slots"
                className="rounded-2xl w-full"
                src="/newhero.jpeg"
                width={800}
                height={500}
              />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-7xl mx-auto px-8 py-24">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-semibold text-on-surface">
              {t('featuresTitle')}
            </h2>
            <p className="text-on-surface-variant max-w-2xl mx-auto">
              {locale === 'zh-HK'
                ? '專為香港小商戶量身打造，一站式預約管理平台。'
                : 'The all-in-one platform designed specifically for the unique needs of local businesses in Hong Kong.'}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div
                key={i}
                className="p-8 rounded-3xl bg-surface neomorph-inset flex flex-col gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-surface neomorph-raised flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">{f.icon}</span>
                </div>
                <h3 className="text-xl font-semibold text-on-surface">
                  {f.title}
                </h3>
                <p className="text-on-surface-variant">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it Works */}
        <section
          id="how-it-works"
          className="max-w-7xl mx-auto px-8 py-24 bg-surface-bright rounded-[3rem] neomorph-raised my-12"
        >
          <div className="text-center mb-16">
            <h2 className="text-4xl font-semibold text-on-surface">
              {locale === 'zh-HK' ? '三步即可開始' : 'Get Started in 3 Steps'}
            </h2>
          </div>
          <div className="flex flex-col lg:flex-row justify-between items-start gap-12 relative">
            <div className="hidden lg:block absolute top-1/4 left-0 w-full h-0.5 bg-outline-variant neomorph-inset" />
            {steps.map((item) => (
              <div
                key={item.num}
                className="relative z-10 flex flex-col items-center text-center gap-6 w-full lg:w-1/3"
              >
                <div className="w-16 h-16 rounded-full bg-surface neomorph-raised flex items-center justify-center text-2xl font-bold text-primary">
                  {item.num}
                </div>
                <div className="p-6 rounded-2xl bg-surface neomorph-inset w-full">
                  <h4 className="text-lg font-semibold mb-2">{item.title}</h4>
                  <p className="text-sm text-on-surface-variant">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="max-w-7xl mx-auto px-8 py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-semibold text-on-surface">
              {t('pricingTitle')}
            </h2>
            <p className="mt-4 text-on-surface-variant">{t('freeTrial')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Starter */}
            <div className="p-8 rounded-3xl bg-surface neomorph-raised flex flex-col">
              <div className="mb-8">
                <h3 className="text-xl font-semibold">{t('starterPlan')}</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-bold text-on-surface">$0</span>
                  <span className="text-on-surface-variant ml-2">
                    {t('perMonth')}
                  </span>
                </div>
              </div>
              <ul className="space-y-4 mb-8 flex-grow">
                {starterFeatures.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 text-on-surface-variant"
                  >
                    <Check size={18} className="text-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                className="w-full py-3 rounded-xl bg-surface neomorph-inset text-on-surface-variant font-semibold text-center block"
              >
                {t('getStarted')}
              </Link>
            </div>

            {/* Pro */}
            <div className="p-8 rounded-3xl bg-surface neomorph-raised flex flex-col relative scale-105 border-2 border-primary/10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-xs font-bold rounded-full">
                {locale === 'zh-HK' ? '最受歡迎' : 'MOST POPULAR'}
              </div>
              <div className="mb-8">
                <h3 className="text-xl font-semibold">{t('proPlan')}</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-bold text-on-surface">
                    $198
                  </span>
                  <span className="text-on-surface-variant ml-2">
                    {t('perMonth')}
                  </span>
                </div>
              </div>
              <ul className="space-y-4 mb-8 flex-grow">
                {proFeatures.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 text-on-surface-variant"
                  >
                    <Check size={18} className="text-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                className="w-full py-3 rounded-xl bg-surface neomorph-raised text-primary font-bold text-center block neomorph-hover transition-all"
              >
                {locale === 'zh-HK' ? '升級專業版' : 'Go Pro'}
              </Link>
            </div>

            {/* Pro + AI */}
            <div className="p-8 rounded-3xl bg-surface neomorph-raised flex flex-col">
              <div className="mb-8">
                <h3 className="text-xl font-semibold">{t('proAiPlan')}</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-bold text-on-surface">
                    $388
                  </span>
                  <span className="text-on-surface-variant ml-2">
                    {t('perMonth')}
                  </span>
                </div>
              </div>
              <ul className="space-y-4 mb-8 flex-grow">
                {proAiFeatures.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 text-on-surface-variant"
                  >
                    <Check size={18} className="text-accent flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                className="w-full py-3 rounded-xl bg-surface neomorph-inset text-accent font-semibold text-center block neomorph-hover transition-all"
              >
                {locale === 'zh-HK' ? '升級至 AI 版' : 'Upgrade to AI'}
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-4xl mx-auto px-8 py-24 text-center">
          <div className="p-16 rounded-[3rem] bg-surface neomorph-raised space-y-10">
            <h2 className="text-4xl font-semibold text-on-surface leading-tight">
              {locale === 'zh-HK'
                ? '準備好告別 WhatsApp 接單混亂？'
                : 'Ready to stop managing bookings on WhatsApp?'}
            </h2>
            <p className="text-xl text-on-surface-variant">
              {locale === 'zh-HK'
                ? '加入 500+ 香港商戶，用 BookEasy HK 取回你的時間。'
                : 'Join 500+ Hong Kong businesses who reclaimed their time with BookEasy HK.'}
            </p>
            <div className="flex justify-center">
              <Link
                href="/auth/signup"
                className="px-12 py-5 rounded-2xl bg-surface neomorph-raised text-primary text-xl font-bold neomorph-hover transition-all active:scale-95"
              >
                {t('heroCta')}
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-bg border-t border-outline-variant py-12 mt-20">
        <div className="flex flex-col md:flex-row justify-between items-center w-full px-8 max-w-7xl mx-auto gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bookeasy-logo.svg" alt="BookEasy HK" className="h-10 w-auto" />
          <p className="text-sm text-muted">© 2026 BookEasy HK. All rights reserved.</p>
          <div className="flex gap-8">
            <a
              className="text-sm text-muted hover:text-primary transition-colors opacity-80 hover:opacity-100"
              href="#"
            >
              {locale === 'zh-HK' ? '私隱政策' : 'Privacy Policy'}
            </a>
            <a
              className="text-sm text-muted hover:text-primary transition-colors opacity-80 hover:opacity-100"
              href="#"
            >
              {locale === 'zh-HK' ? '服務條款' : 'Terms of Service'}
            </a>
            <a
              className="text-sm text-muted hover:text-primary transition-colors opacity-80 hover:opacity-100"
              href="mailto:hello@bookeasyhk.com"
            >
              {locale === 'zh-HK' ? '聯絡我們' : 'Contact Us'}
            </a>
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
