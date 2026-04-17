'use client';

import { I18nProvider, useI18n } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/language-toggle';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Calendar, List, Settings, ExternalLink, LogOut, Menu, X, Building2, BriefcaseBusiness, Inbox, MessageSquareText } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import type { Business } from '@/lib/types';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { t, locale } = useI18n();
  const zh = locale === 'zh-HK';
  const router = useRouter();
  const pathname = usePathname();
  const [business, setBusiness] = useState<Business | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadBusiness = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single();
    if (!data) { router.push('/onboarding'); return; }
    setBusiness(data);

    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', data.id)
      .eq('status', 'pending');

    setPendingCount(count || 0);
  }, [router]);

  useEffect(() => {
    const run = async () => {
      await loadBusiness();
    };

    void run();
  }, [loadBusiness]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const navItems = [
    { href: '/dashboard', label: t('todaySchedule'), icon: Calendar, exact: true },
    { href: '/dashboard/requests', label: t('bookingRequests'), icon: Inbox, exact: true, showPendingDot: true },
    { href: '/dashboard/bookings', label: t('allBookings'), icon: List },
    { href: '/dashboard/settings/business', label: zh ? '商戶' : 'Business', icon: Building2 },
    { href: '/dashboard/settings/services', label: zh ? '服務' : 'Services', icon: BriefcaseBusiness },
    { href: '/dashboard/settings/booking-questions', label: zh ? '預約問題' : 'Booking Questions', icon: MessageSquareText },
  ];

  const initials = business?.name
    ? business.name.slice(0, 1).toUpperCase()
    : '?';

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-56 bg-[#111111] flex flex-col transform transition-transform lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="font-display text-[17px] font-light text-white">
              BookEasy<span className="text-[#0D9488]">.</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/40 hover:text-white/70 transition-colors">
              <X size={16} />
            </button>
          </div>
          {business && (
            <p className="text-[11px] text-white/40 mt-1 truncate">{business.name}</p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4">
          <div className="text-[10px] font-semibold tracking-widest text-white/25 uppercase px-2 mb-2">
            {zh ? '主選單' : 'Main'}
          </div>
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors border-l-2 ${
                  isActive
                    ? 'bg-white/6 text-white border-[#0D9488]'
                    : 'text-white/50 hover:text-white/70 hover:bg-white/4 border-transparent'
                }`}
              >
                <item.icon size={15} />
                <span className="flex-1 min-w-0 truncate">{item.label}</span>
                {item.showPendingDot && pendingCount > 0 && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    <Badge variant="danger" className="px-1.5 py-0 text-[10px]">
                      {pendingCount}
                    </Badge>
                  </>
                )}
              </Link>
            );
          })}

          {business && (
            <>
              <div className="text-[10px] font-semibold tracking-widest text-white/25 uppercase px-2 mb-2 mt-4">
                {zh ? '快捷' : 'Quick'}
              </div>
              <a
                href={`/book/${business.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white/70 hover:bg-white/4 transition-colors border-l-2 border-transparent"
              >
                <ExternalLink size={15} />
                {t('bookingPage')}
              </a>
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <Link
            href="/dashboard/settings"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors w-full ${
              pathname === '/dashboard/settings'
                ? 'bg-white/6 text-white border-l-2 border-[#0D9488]'
                : 'text-white/50 hover:text-white/70 hover:bg-white/4 border-l-2 border-transparent'
            }`}
          >
            <Settings size={15} />
            {zh ? '網站設定' : 'Website Settings'}
          </Link>
          <div className="px-3 py-2">
            <LanguageToggle className="w-full" />
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-red-400 hover:bg-white/4 transition-colors w-full"
          >
            <LogOut size={15} />
            {t('logout')}
          </button>

          {/* User info */}
          <div className="flex items-center gap-2.5 px-3 py-2 mt-2 border-t border-white/10 pt-3">
            <div className="w-7 h-7 rounded-lg bg-[#0F766E] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-white/60 font-medium truncate">{business?.name || '…'}</div>
              <div className="text-[10px] text-white/30">{zh ? '商戶管理員' : 'Business Admin'}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-[#E5E7EB] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="text-[#6B7280] hover:text-[#111111] transition-colors">
            <Menu size={20} />
          </button>
          <span className="font-display text-base font-light text-[#111111]">
            BookEasy<span className="text-[#0F766E]">.</span>
          </span>
          <LanguageToggle />
        </header>

        <main className="flex-1 p-5 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <DashboardShell>{children}</DashboardShell>
    </I18nProvider>
  );
}
