'use client';

import { I18nProvider, useI18n } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/language-toggle';
import Link from 'next/link';
import Image from 'next/image';
import { Check, Menu, X, ArrowRight } from 'lucide-react';
import { useState } from 'react';

function LandingPage() {
  const { t, locale } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const zh = locale === 'zh-HK';

  const features = [
    { icon: '💬', title: zh ? 'WhatsApp 自動提醒' : 'WhatsApp Reminders', desc: zh ? '預約確認後，自動發送24小時及2小時前提醒，大幅減少爽約。' : 'Auto-send WhatsApp reminders 24h and 2h before appointments. Reduce no-shows by 80%.' },
    { icon: '🈳', title: zh ? '繁體中文介面' : 'Bilingual Interface', desc: zh ? '完整繁體中文及英文雙語，讓客人用最熟悉的語言輕鬆預約。' : 'Full Traditional Chinese and English support for your Hong Kong customers.' },
    { icon: '⚡', title: zh ? '實時防撞期' : 'Conflict Prevention', desc: zh ? '智能時間管理，自動防止重複預約，輕鬆掌控日程。' : 'Smart scheduling prevents double-bookings and overlapping appointments automatically.' },
    { icon: '📱', title: zh ? '手機優先設計' : 'Mobile-First Design', desc: zh ? '無需下載App，客人直接在瀏覽器完成預約，適配所有設備。' : 'No app download needed. Customers book directly in any mobile browser.' },
    { icon: '🔗', title: zh ? '專屬預約連結' : 'Custom Booking Link', desc: zh ? '獲得專屬連結，可放在Instagram、WhatsApp Bio或名片上。' : 'Get your own booking page link to share on Instagram, WhatsApp, or business cards.' },
    { icon: '📊', title: zh ? 'AI 智能分析' : 'AI Smart Analytics', desc: zh ? '洞察業務趨勢，識別高峰時段，優化服務安排。' : 'Understand your busiest hours and optimize staff scheduling with AI insights.' },
  ];

  const starterFeatures = zh
    ? ['每月 50 個預約', '基礎提醒功能', '1 個服務項目', '標準預約頁面']
    : ['50 bookings/month', 'Basic reminders', '1 service type', 'Standard booking page'];

  const proFeatures = zh
    ? ['無限預約', 'WhatsApp 自動提醒', '無限服務項目', '自訂品牌頁面', '優先客服支援']
    : ['Unlimited bookings', 'WhatsApp auto-reminders', 'Unlimited services', 'Custom branding', 'Priority support'];

  const proAiFeatures = zh
    ? ['所有 Pro 功能', 'AI 智能排程助手', '智能容量分析', '高級業務洞察', '專屬客戶成功經理']
    : ['Everything in Pro', 'AI Scheduling Assistant', 'Smart Capacity Analytics', 'Advanced insights', 'Dedicated CSM'];

  const steps = [
    { num: '01', title: zh ? '建立帳戶' : 'Create Account', desc: zh ? '以電郵數秒內完成註冊，無需信用卡。' : 'Register with your email in seconds. No credit card required.' },
    { num: '02', title: zh ? '設定服務' : 'Set Up Services', desc: zh ? '輸入服務項目、價錢及營業時間。' : 'Add your services, prices, and opening hours.' },
    { num: '03', title: zh ? '分享連結' : 'Share Your Link', desc: zh ? '將專屬預約連結分享到 Instagram 或 WhatsApp。' : 'Share your booking link on Instagram Bio or WhatsApp.' },
  ];

  const stats = [
    { value: '30s', label: zh ? '完成設定' : 'Setup time' },
    { value: '0%', label: zh ? '每單佣金' : 'Per-booking fees' },
    { value: '24/7', label: zh ? '客戶隨時預約' : 'Bookings open' },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#111111]">

      {/* ── NAV ── */}
      <nav className="bg-white border-b border-[#E5E7EB] sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-6 md:px-12 py-0 max-w-7xl mx-auto h-16">
          <span className="font-display text-xl font-light tracking-tight text-[#111111]">
            BookEasy<span className="text-[#0F766E]">.</span>
          </span>

          {/* Desktop links */}
          <div className="hidden md:flex gap-8 items-center">
            {[
              [zh ? '功能' : 'Features', '#features'],
              [zh ? '使用方法' : 'How it Works', '#how-it-works'],
              [zh ? '收費' : 'Pricing', '#pricing'],
            ].map(([label, href]) => (
              <a key={href} href={href} className="text-sm text-[#6B7280] hover:text-[#111111] transition-colors">
                {label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex gap-3 items-center">
            <LanguageToggle />
            <Link href="/auth/login" className="px-4 py-2 text-sm text-[#3D3D3D] border border-[#E5E7EB] rounded-lg hover:border-[#0F766E] transition-colors">
              {t('login')}
            </Link>
            <Link href="/auth/signup" className="px-4 py-2 text-sm text-white bg-[#0F766E] rounded-lg font-medium hover:bg-[#0D9488] transition-colors">
              {t('heroCta')} →
            </Link>
          </div>

          {/* Mobile */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageToggle />
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-9 h-9 rounded-lg border border-[#E5E7EB] flex items-center justify-center text-[#6B7280]"
            >
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden px-6 pb-4 space-y-1 border-t border-[#E5E7EB] bg-white">
            {[
              [zh ? '功能' : 'Features', '#features'],
              [zh ? '使用方法' : 'How it Works', '#how-it-works'],
              [zh ? '收費' : 'Pricing', '#pricing'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 text-sm text-[#6B7280] hover:text-[#111111] rounded-lg hover:bg-[#F9FAFB] transition-colors mt-1"
              >
                {label}
              </a>
            ))}
            <div className="pt-3 flex flex-col gap-2 border-t border-[#E5E7EB]">
              <Link href="/auth/login" className="py-2.5 text-sm text-center text-[#3D3D3D] border border-[#E5E7EB] rounded-lg">
                {t('login')}
              </Link>
              <Link href="/auth/signup" className="py-2.5 text-sm text-center text-white bg-[#0F766E] rounded-lg font-medium">
                {t('heroCta')}
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main>
        {/* ── HERO ── */}
        <section className="max-w-7xl mx-auto px-6 md:px-12 pt-20 pb-16">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div className="space-y-7 animate-fade-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#CCFBF1] text-[#0F766E] text-xs font-semibold tracking-wide uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E]" />
                {zh ? '香港中小企預約平台' : 'HK Appointment Platform'}
              </div>

              <h1 className="font-display text-5xl lg:text-6xl font-light leading-[1.1] tracking-tight text-[#111111]">
                {zh ? (
                  <>讓客人<br /><em className="text-[#0F766E] not-italic">輕鬆預約，</em><br />讓你省心管理。</>
                ) : (
                  <>Bookings that<br /><em className="text-[#0F766E] not-italic">run themselves.</em></>
                )}
              </h1>

              <p className="text-[15px] leading-relaxed text-[#6B7280] max-w-md">
                {zh
                  ? '專為香港美容、美甲、寵物護理等行業設計。30秒完成設定，自動WhatsApp提醒，大幅減少爽約率。'
                  : 'Designed for Hong Kong salons, spas, and service businesses. Set up in 30 seconds. WhatsApp reminders sent automatically.'}
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#0F766E] text-white text-sm font-medium rounded-lg hover:bg-[#0D9488] transition-colors"
                >
                  {zh ? '免費試用 14 天' : 'Start free 14-day trial'}
                  <ArrowRight size={14} />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 px-6 py-3 text-[#3D3D3D] text-sm border border-[#E5E7EB] rounded-lg hover:border-[#0F766E] transition-colors"
                >
                  {zh ? '觀看示範' : 'See how it works'}
                </a>
              </div>

              <p className="text-xs text-[#9CA3AF]">
                {zh ? '無需信用卡 · 即時啟用 · 隨時取消' : 'No credit card · Instant setup · Cancel anytime'}
              </p>
            </div>

            {/* Right: Hero image */}
            <div className="relative animate-fade-up" style={{ animationDelay: '0.1s' }}>
              <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-elevated">
                <Image
                  src="/herosquare.png"
                  alt={zh ? 'BookEasy 預約流程示範' : 'BookEasy booking flow preview'}
                  width={1024}
                  height={1024}
                  priority
                  className="w-full h-auto block"
                />
              </div>

              {/* Floating badge */}
              <div className="absolute -top-3 -right-3 bg-[#111111] text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-elevated">
                {zh ? '爽約率 ↓ 80%' : '80% fewer no-shows'}
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <section className="max-w-7xl mx-auto px-6 md:px-12 pb-16">
          <div className="grid grid-cols-3 divide-x divide-[#E5E7EB] border border-[#E5E7EB] rounded-xl bg-white overflow-hidden">
            {stats.map(({ value, label }) => (
              <div key={label} className="py-6 px-8 text-center">
                <div className="font-display text-4xl font-light text-[#0F766E] mb-1">{value}</div>
                <div className="text-sm text-[#6B7280]">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="bg-[#FAFAF8] border-y border-[#E5E7EB] py-20">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="mb-12">
              <p className="text-xs font-semibold tracking-widest text-[#0F766E] uppercase mb-2">
                {zh ? '核心功能' : 'Core Features'}
              </p>
              <h2 className="font-display text-4xl font-light text-[#111111] leading-tight">
                {zh ? '一切你需要的，一個平台搞定。' : 'Everything you need, in one place.'}
              </h2>
            </div>

            {/* Feature grid with border pattern */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border border-[#E5E7EB] rounded-xl overflow-hidden bg-white">
              {features.map((f, i) => (
                <div
                  key={i}
                  className={`p-7 ${i % 3 !== 2 ? 'md:border-r' : ''} ${i < 3 ? 'border-b' : ''} border-[#E5E7EB]`}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#CCFBF1] flex items-center justify-center text-base mb-4">
                    {f.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-[#111111] mb-2">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-[#6B7280]">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="py-20">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="mb-12">
              <p className="text-xs font-semibold tracking-widest text-[#0F766E] uppercase mb-2">
                {zh ? '如何開始' : 'Getting Started'}
              </p>
              <h2 className="font-display text-4xl font-light text-[#111111]">
                {zh ? '三步即可開始' : 'Get started in 3 steps'}
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {steps.map((step) => (
                <div key={step.num} className="bg-white border border-[#E5E7EB] rounded-xl p-6">
                  <div className="font-display text-5xl font-light text-[#0F766E] mb-4 leading-none">{step.num}</div>
                  <h3 className="text-base font-semibold text-[#111111] mb-2">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-[#6B7280]">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className="bg-[#FAFAF8] border-t border-[#E5E7EB] py-20">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="mb-12">
              <p className="text-xs font-semibold tracking-widest text-[#0F766E] uppercase mb-2">
                {zh ? '收費方案' : 'Pricing'}
              </p>
              <h2 className="font-display text-4xl font-light text-[#111111]">
                {zh ? '透明收費，按需選擇。' : 'Simple, transparent pricing.'}
              </h2>
              <p className="text-sm text-[#6B7280] mt-2">{t('freeTrial')}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {/* Starter */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-7 flex flex-col">
                <div className="text-xs font-semibold tracking-widest text-[#6B7280] uppercase mb-2">{t('starterPlan')}</div>
                <div className="font-display text-5xl font-light text-[#111111] leading-none mb-1">$0</div>
                <div className="text-xs text-[#6B7280] mb-6">{t('perMonth')}</div>
                <ul className="space-y-2.5 mb-8 flex-grow">
                  {starterFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-[#3D3D3D]">
                      <Check size={14} className="text-[#0F766E] mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className="block w-full py-2.5 text-sm text-center text-[#3D3D3D] border border-[#E5E7EB] rounded-lg hover:border-[#0F766E] transition-colors">
                  {t('getStarted')}
                </Link>
              </div>

              {/* Pro — featured */}
              <div className="bg-[#111111] border border-[#111111] rounded-2xl p-7 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#0F766E] text-white text-[10px] font-bold uppercase tracking-widest rounded-b-full">
                  {zh ? '最多人選擇' : 'Most Popular'}
                </div>
                <div className="text-xs font-semibold tracking-widest text-white/50 uppercase mb-2 mt-4">{t('proPlan')}</div>
                <div className="font-display text-5xl font-light text-white leading-none mb-1">$198</div>
                <div className="text-xs text-white/40 mb-6">{zh ? '每月 · HKD' : '/month HKD'}</div>
                <ul className="space-y-2.5 mb-8 flex-grow">
                  {proFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                      <Check size={14} className="text-[#0D9488] mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className="block w-full py-2.5 text-sm text-center text-white bg-[#0F766E] rounded-lg font-medium hover:bg-[#0D9488] transition-colors">
                  {zh ? '免費試用 14 天' : 'Start free trial'}
                </Link>
              </div>

              {/* Pro + AI */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-7 flex flex-col">
                <div className="text-xs font-semibold tracking-widest text-[#6B7280] uppercase mb-2">{t('proAiPlan')}</div>
                <div className="font-display text-5xl font-light text-[#111111] leading-none mb-1">$388</div>
                <div className="text-xs text-[#6B7280] mb-6">{zh ? '每月 · HKD' : '/month HKD'}</div>
                <ul className="space-y-2.5 mb-8 flex-grow">
                  {proAiFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-[#3D3D3D]">
                      <Check size={14} className="text-[#0F766E] mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className="block w-full py-2.5 text-sm text-center text-[#3D3D3D] border border-[#E5E7EB] rounded-lg hover:border-[#0F766E] transition-colors">
                  {zh ? '聯絡我們' : 'Contact us'}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="py-24">
          <div className="max-w-3xl mx-auto px-6 md:px-12 text-center">
            <h2 className="font-display text-5xl font-light text-[#111111] leading-tight mb-5">
              {zh ? '準備好開始了嗎？' : 'Ready to get started?'}
            </h2>
            <p className="text-[#6B7280] mb-8 text-base">
              {zh
                ? '加入 2,400+ 香港商戶，用 BookEasy HK 取回你的時間。'
                : 'Join 2,400+ Hong Kong businesses who simplified their booking with BookEasy HK.'}
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#0F766E] text-white font-medium rounded-xl text-sm hover:bg-[#0D9488] transition-colors"
            >
              {zh ? '免費試用 14 天' : 'Start free 14-day trial'}
              <ArrowRight size={15} />
            </Link>
            <p className="text-xs text-[#9CA3AF] mt-4">
              {zh ? '無需信用卡 · 即時啟用 · 隨時取消' : 'No credit card · Instant setup · Cancel anytime'}
            </p>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#E5E7EB] py-10 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-display text-lg font-light text-[#111111]">
            BookEasy<span className="text-[#0F766E]">.</span>
          </span>
          <p className="text-xs text-[#9CA3AF]">© 2026 BookEasy HK. All rights reserved.</p>
          <div className="flex gap-6">
            {[
              [zh ? '私隱政策' : 'Privacy', '#'],
              [zh ? '服務條款' : 'Terms', '#'],
              [zh ? '聯絡我們' : 'Contact', 'mailto:hello@bookeasyhk.com'],
            ].map(([label, href]) => (
              <a key={label} href={href} className="text-xs text-[#6B7280] hover:text-[#0F766E] transition-colors">
                {label}
              </a>
            ))}
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
