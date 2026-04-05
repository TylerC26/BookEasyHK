'use client';

import { I18nProvider, useI18n } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/language-toggle';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Clock, Settings, ExternalLink, LogOut, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Business } from '@/lib/types';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [business, setBusiness] = useState<Business | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadBusiness();
  }, []);

  const loadBusiness = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', user.id)
      .single();

    if (!data) {
      router.push('/onboarding');
      return;
    }

    setBusiness(data);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const navItems = [
    { href: '/dashboard', label: t('todaySchedule'), icon: Calendar, exact: true },
    { href: '/dashboard/bookings', label: t('allBookings'), icon: Clock },
    { href: '/dashboard/settings', label: t('settings'), icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-border flex flex-col transform transition-transform lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <Link href="/dashboard">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/bookeasy-logo.svg" alt="BookEasy HK" className="h-10 w-auto" />
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden cursor-pointer">
              <X size={20} />
            </button>
          </div>
          {business && (
            <p className="text-xs text-muted mt-1 truncate">{business.name}</p>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-light text-primary'
                    : 'text-muted hover:bg-slate-50 hover:text-secondary'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}

          {business && (
            <a
              href={`/book/${business.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-slate-50 hover:text-secondary transition-colors"
            >
              <ExternalLink size={18} />
              {t('bookingPage')}
            </a>
          )}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <LanguageToggle className="w-full" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-red-50 hover:text-danger transition-colors w-full cursor-pointer"
          >
            <LogOut size={18} />
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="cursor-pointer">
            <Menu size={24} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bookeasy-logo.svg" alt="BookEasy HK" className="h-8 w-auto" />
          <LanguageToggle />
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-5xl">
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
