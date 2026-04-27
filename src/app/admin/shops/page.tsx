'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatPrice, getBusinessTypeEmoji } from '@/lib/utils';
import { Search, ExternalLink, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Business } from '@/lib/types';

type ShopRow = Business & { _bookings: number; _revenue: number };

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'nail', label: 'Nail' },
  { value: 'hair', label: 'Hair' },
  { value: 'carwash', label: 'Carwash' },
  { value: 'pet', label: 'Pet' },
  { value: 'massage', label: 'Massage' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Onboarding' },
];

const SORT_OPTIONS = [
  { value: 'created_desc', label: 'Newest first' },
  { value: 'created_asc', label: 'Oldest first' },
  { value: 'name_asc', label: 'Name A→Z' },
  { value: 'name_desc', label: 'Name Z→A' },
];

export default function AdminShopsPage() {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('created_desc');

  useEffect(() => {
    setLoading(true);
    const ctrl = new AbortController();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (sort) params.set('sort', sort);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/shops?${params.toString()}`, {
          cache: 'no-store',
          signal: ctrl.signal,
        });
        if (res.ok) {
          const body = await res.json();
          setShops(body.shops || []);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error(err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [search, type, status, sort]);

  const summary = useMemo(() => {
    const total = shops.length;
    const active = shops.filter((s) => s.onboarding_complete).length;
    const bookings = shops.reduce((sum, s) => sum + s._bookings, 0);
    return { total, active, bookings };
  }, [shops]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#111111]">Shops</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            {loading
              ? 'Loading shops…'
              : `${summary.total} shops · ${summary.active} active · ${summary.bookings} bookings`}
          </p>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
            <Input
              placeholder="Search name, slug, phone, district…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={TYPE_OPTIONS}
          />
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={STATUS_OPTIONS}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-[#6B7280]">Sort:</span>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            options={SORT_OPTIONS}
            className="w-auto"
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-[#6B7280]">Loading…</div>
        ) : shops.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#6B7280]">No shops match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FAFAF8] text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                <tr>
                  <th className="text-left px-4 py-3">Shop</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">District</th>
                  <th className="text-right px-4 py-3">Bookings</th>
                  <th className="text-right px-4 py-3">Revenue</th>
                  <th className="text-left px-4 py-3">Joined</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {shops.map((s) => (
                  <tr key={s.id} className="hover:bg-[#FAFAF8] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/shops/${s.id}`} className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-base flex-shrink-0">
                          {getBusinessTypeEmoji(s.type)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-[#111111] truncate">{s.name}</div>
                          <div className="text-xs text-[#9CA3AF] truncate">/{s.slug}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize text-[#3D3D3D]">{s.type}</td>
                    <td className="px-4 py-3 text-[#3D3D3D]">{s.district || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#3D3D3D]">{s._bookings}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#3D3D3D]">
                      {s._revenue > 0 ? formatPrice(s._revenue) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#6B7280] whitespace-nowrap">
                      {format(parseISO(s.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      {s.onboarding_complete ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="warning">Onboarding</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <a
                          href={`/book/${s.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[#9CA3AF] hover:text-[#0F766E] transition-colors"
                          title="Open public booking page"
                        >
                          <ExternalLink size={14} />
                        </a>
                        <Link
                          href={`/admin/shops/${s.id}`}
                          className="text-[#9CA3AF] hover:text-[#111111] transition-colors"
                        >
                          <ChevronRight size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
