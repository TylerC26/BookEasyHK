'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPrice, getBusinessTypeEmoji } from '@/lib/utils';
import { Store, CalendarCheck, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';

type RecentShop = {
  id: string;
  name: string;
  type: string;
  slug: string;
  district: string | null;
  created_at: string;
  onboarding_complete: boolean;
};

type Stats = {
  shopsTotal: number;
  shopsActive: number;
  bookingsTotal: number;
  bookingsPending: number;
  bookings30d: number;
  totalRevenue: number;
  recentShops: RecentShop[];
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/stats', { cache: 'no-store' });
      if (res.ok) setStats(await res.json());
      setLoading(false);
    })();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#111111]">Platform overview</h1>
        <p className="text-sm text-[#6B7280] mt-1">Live stats across all shops on BookEasy.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Store size={16} />}
          label="Shops"
          primary={loading ? '—' : String(stats?.shopsTotal ?? 0)}
          hint={loading ? '' : `${stats?.shopsActive ?? 0} onboarded`}
        />
        <StatCard
          icon={<CalendarCheck size={16} />}
          label="Bookings (all time)"
          primary={loading ? '—' : String(stats?.bookingsTotal ?? 0)}
          hint={loading ? '' : `${stats?.bookings30d ?? 0} in last 30d`}
        />
        <StatCard
          icon={<Clock size={16} />}
          label="Pending confirmations"
          primary={loading ? '—' : String(stats?.bookingsPending ?? 0)}
          hint="Awaiting shop action"
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Completed revenue"
          primary={loading ? '—' : formatPrice(stats?.totalRevenue ?? 0)}
          hint="Across all shops"
        />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#111111]">Recently joined shops</h2>
          <Link href="/admin/shops" className="text-xs text-[#0F766E] hover:underline inline-flex items-center gap-1">
            View all <ChevronRight size={12} />
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-[#6B7280] py-6 text-center">Loading…</p>
        ) : (stats?.recentShops || []).length === 0 ? (
          <p className="text-sm text-[#6B7280] py-6 text-center">No shops yet.</p>
        ) : (
          <div className="divide-y divide-[#F3F4F6] -mx-2">
            {stats!.recentShops.map((s) => (
              <Link
                key={s.id}
                href={`/admin/shops/${s.id}`}
                className="flex items-center gap-3 px-2 py-3 hover:bg-[#FAFAF8] rounded-lg transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-lg flex-shrink-0">
                  {getBusinessTypeEmoji(s.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[#111111] truncate">{s.name}</div>
                  <div className="text-xs text-[#6B7280] truncate">
                    {s.district || 'No district'} · {format(parseISO(s.created_at), 'MMM d, yyyy')}
                  </div>
                </div>
                {!s.onboarding_complete && (
                  <Badge variant="warning">Onboarding</Badge>
                )}
                <ChevronRight size={14} className="text-[#9CA3AF] flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  primary,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[#6B7280] text-xs font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-[#111111]">{primary}</div>
      {hint && <div className="mt-1 text-xs text-[#9CA3AF]">{hint}</div>}
    </Card>
  );
}
