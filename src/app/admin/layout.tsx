'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Store, LogOut, Menu, X, ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading');
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch('/api/admin/me', { cache: 'no-store' });
      if (!active) return;
      if (res.ok) {
        const body = await res.json();
        setEmail(body.email || '');
        setState('ok');
      } else if (res.status === 401) {
        router.replace('/auth/login?next=/admin');
      } else {
        setState('denied');
      }
    })();
    return () => { active = false; };
  }, [router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const navItems = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/admin/shops', label: 'Shops', icon: Store },
  ];

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center text-sm text-[#6B7280]">
        Loading…
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
            <ShieldCheck size={20} />
          </div>
          <h1 className="text-xl font-semibold text-[#111111] mb-2">Admin access required</h1>
          <p className="text-sm text-[#6B7280] mb-6">
            Your account is signed in but isn&apos;t on the platform admin list. If this is wrong, add
            your email to the <code className="px-1 py-0.5 rounded bg-[#F3F4F6]">ADMIN_EMAILS</code> env var.
          </p>
          <button
            onClick={handleLogout}
            className="text-sm text-[#0F766E] hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-56 bg-[#111111] flex flex-col transform transition-transform lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="font-display text-[17px] font-light text-white">
              BookEasy<span className="text-[#0D9488]">.</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/40 hover:text-white/70 transition-colors">
              <X size={16} />
            </button>
          </div>
          <p className="text-[11px] text-white/40 mt-1 truncate">Platform admin</p>
        </div>

        <nav className="flex-1 px-3 py-4">
          <div className="text-[10px] font-semibold tracking-widest text-white/25 uppercase px-2 mb-2">
            Admin
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
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white/70 hover:bg-white/4 transition-colors w-full"
          >
            <LayoutDashboard size={15} />
            My business dashboard
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-red-400 hover:bg-white/4 transition-colors w-full"
          >
            <LogOut size={15} />
            Sign out
          </button>

          <div className="flex items-center gap-2.5 px-3 py-2 mt-2 border-t border-white/10 pt-3">
            <div className="w-7 h-7 rounded-lg bg-[#0F766E] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              <ShieldCheck size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-white/60 font-medium truncate">{email}</div>
              <div className="text-[10px] text-white/30">Platform admin</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-white border-b border-[#E5E7EB] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="text-[#6B7280] hover:text-[#111111] transition-colors">
            <Menu size={20} />
          </button>
          <span className="font-display text-base font-light text-[#111111]">
            BookEasy<span className="text-[#0F766E]">.</span>
          </span>
          <span className="text-[10px] font-semibold tracking-widest text-[#0F766E] uppercase">Admin</span>
        </header>

        <main className="flex-1 p-5 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
