'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice, formatTime, getBusinessTypeEmoji } from '@/lib/utils';
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
  Phone,
  MapPin,
  Mail,
  Globe,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Business, Service, Booking, WorkingHours, BookingStatus } from '@/lib/types';

const STATUS_BADGE: Record<BookingStatus, { variant: 'default' | 'success' | 'warning' | 'danger' | 'muted'; label: string }> = {
  pending: { variant: 'warning', label: 'Pending' },
  confirmed: { variant: 'default', label: 'Confirmed' },
  completed: { variant: 'success', label: 'Completed' },
  no_show: { variant: 'danger', label: 'No-show' },
  cancelled: { variant: 'muted', label: 'Cancelled' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Detail = {
  shop: Business;
  services: Service[];
  bookings: Booking[];
  workingHours: WorkingHours[];
  stats: {
    totalBookings: number;
    revenue: number;
    byStatus: Record<BookingStatus, number>;
  };
  owner: { id: string; email: string | null; created_at: string } | null;
};

export default function AdminShopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/shops/${id}`, { cache: 'no-store' });
      if (res.status === 404) {
        setNotFound(true);
      } else if (res.ok) {
        setData(await res.json());
      }
      setLoading(false);
    })();
  }, [id]);

  const handleDelete = async () => {
    if (!data) return;
    const confirmText = `Delete "${data.shop.name}"? This removes the shop and ALL its bookings, services, and data. This cannot be undone.`;
    if (!window.confirm(confirmText)) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/shops/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/admin/shops');
    } else {
      const body = await res.json().catch(() => ({ error: 'delete_failed' }));
      alert(`Delete failed: ${body.error || 'unknown error'}`);
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto text-sm text-[#6B7280] py-10 text-center">Loading…</div>;
  }

  if (notFound || !data) {
    return (
      <div className="max-w-5xl mx-auto">
        <Link href="/admin/shops" className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#111111] mb-4">
          <ArrowLeft size={14} /> Back to shops
        </Link>
        <Card>
          <p className="text-sm text-[#6B7280]">Shop not found.</p>
        </Card>
      </div>
    );
  }

  const { shop, services, bookings, workingHours, stats, owner } = data;
  const social = shop.social_links || {};

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href="/admin/shops" className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#111111]">
        <ArrowLeft size={14} /> Back to shops
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-14 h-14 rounded-xl bg-[#F3F4F6] flex items-center justify-center text-3xl flex-shrink-0">
            {getBusinessTypeEmoji(shop.type)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-[#111111] truncate">{shop.name}</h1>
              {shop.onboarding_complete ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="warning">Onboarding</Badge>
              )}
            </div>
            <div className="text-sm text-[#6B7280] mt-1 capitalize">
              {shop.type} · {shop.district || 'No district'} · Joined {format(parseISO(shop.created_at), 'MMM d, yyyy')}
            </div>
            <div className="text-xs text-[#9CA3AF] mt-0.5">/{shop.slug}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a href={`/book/${shop.slug}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink size={13} />
              Public page
            </Button>
          </a>
          <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
            <Trash2 size={13} />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="Total bookings" value={String(stats.totalBookings)} />
        <MiniStat label="Completed revenue" value={formatPrice(stats.revenue)} />
        <MiniStat label="Pending" value={String(stats.byStatus.pending || 0)} />
        <MiniStat label="Cancelled / no-show" value={String((stats.byStatus.cancelled || 0) + (stats.byStatus.no_show || 0))} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: contact + owner + hours */}
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-[#111111] mb-3">Contact</h2>
            <div className="space-y-2 text-sm">
              <ContactRow icon={<Phone size={13} />} label="Phone" value={shop.phone} />
              <ContactRow icon={<Phone size={13} />} label="WhatsApp" value={shop.whatsapp} />
              <ContactRow
                icon={<MapPin size={13} />}
                label="Address"
                value={shop.address_text}
                link={shop.address_map_link || undefined}
              />
              {social.instagram && (
                <ContactRow icon={<Globe size={13} />} label="Instagram" value={social.instagram} link={social.instagram} />
              )}
              {social.facebook && (
                <ContactRow icon={<Globe size={13} />} label="Facebook" value={social.facebook} link={social.facebook} />
              )}
              {social.threads && (
                <ContactRow icon={<Globe size={13} />} label="Threads" value={social.threads} link={social.threads} />
              )}
              {social.other && (
                <ContactRow icon={<Globe size={13} />} label="Other" value={social.other} link={social.other} />
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-[#111111] mb-3">Owner</h2>
            {owner ? (
              <div className="space-y-2 text-sm">
                <ContactRow icon={<Mail size={13} />} label="Email" value={owner.email} />
                <div className="text-xs text-[#9CA3AF] pt-1 border-t border-[#F3F4F6]">
                  Account since {format(parseISO(owner.created_at), 'MMM d, yyyy')}
                </div>
                <div className="text-[10px] text-[#9CA3AF] font-mono break-all">{owner.id}</div>
              </div>
            ) : (
              <p className="text-sm text-[#6B7280]">Owner account not found.</p>
            )}
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-[#111111] mb-3">Working hours</h2>
            {workingHours.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No hours set.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {workingHours.map((wh) => (
                  <div key={wh.id} className="flex items-center justify-between">
                    <span className="text-[#3D3D3D] font-medium w-10">{DAY_NAMES[wh.day_of_week]}</span>
                    {wh.is_open && wh.open_time && wh.close_time ? (
                      <span className="text-[#6B7280]">
                        {formatTime(wh.open_time)} – {formatTime(wh.close_time)}
                      </span>
                    ) : (
                      <span className="text-[#9CA3AF]">Closed</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-[#111111] mb-3">Booking rules</h2>
            <div className="space-y-1.5 text-sm text-[#3D3D3D]">
              <div className="flex justify-between"><span className="text-[#6B7280]">Buffer</span><span>{shop.buffer_minutes} min</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">Min advance</span><span>{shop.min_advance_hours} hours</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">Max advance</span><span>{shop.max_advance_days} days</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">Language</span><span>{shop.language}</span></div>
            </div>
          </Card>
        </div>

        {/* Right: services + bookings */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-[#111111]">Services ({services.length})</h2>
            </div>
            {services.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No services configured.</p>
            ) : (
              <div className="divide-y divide-[#F3F4F6] -mx-2">
                {services.map((svc) => (
                  <div key={svc.id} className="flex items-center justify-between px-2 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#111111] truncate">
                        {svc.name}
                        {!svc.active && <span className="ml-2 text-xs text-[#9CA3AF]">(inactive)</span>}
                      </div>
                      <div className="text-xs text-[#6B7280]">
                        {svc.duration_minutes} min
                        {svc.pricing_type === 'fixed' && svc.price_hkd !== null && ` · ${formatPrice(svc.price_hkd)}`}
                        {svc.pricing_type === 'tbc' && ' · Price TBC'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-[#111111]">Recent bookings</h2>
              <span className="text-xs text-[#9CA3AF]">Last {bookings.length}</span>
            </div>
            {bookings.length === 0 ? (
              <p className="text-sm text-[#6B7280] py-4 text-center">No bookings yet.</p>
            ) : (
              <div className="divide-y divide-[#F3F4F6] -mx-2">
                {bookings.map((b) => {
                  const badge = STATUS_BADGE[b.status];
                  return (
                    <div key={b.id} className="flex items-center gap-3 px-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-[#111111] truncate">
                          {b.customer_name}
                          {b.service?.name && <span className="text-[#6B7280] font-normal"> · {b.service.name}</span>}
                        </div>
                        <div className="text-xs text-[#6B7280]">
                          {format(parseISO(b.booking_date), 'MMM d, yyyy')} · {formatTime(b.start_time)}
                          {b.price_hkd !== null && ` · ${formatPrice(b.price_hkd)}`}
                        </div>
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-[#6B7280]">{label}</div>
      <div className="mt-1 text-xl font-semibold text-[#111111]">{value}</div>
    </Card>
  );
}

function ContactRow({
  icon,
  label,
  value,
  link,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  link?: string;
}) {
  if (!value) {
    return (
      <div className="flex items-center gap-2 text-[#9CA3AF]">
        <span className="text-[#D1D5DB]">{icon}</span>
        <span className="text-xs">{label}</span>
        <span className="ml-auto text-xs italic">—</span>
      </div>
    );
  }
  const content = (
    <>
      <span className="text-[#6B7280]">{icon}</span>
      <span className="text-xs text-[#6B7280]">{label}</span>
      <span className="ml-auto text-sm text-[#111111] truncate max-w-[60%] text-right">{value}</span>
    </>
  );
  return link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:bg-[#FAFAF8] rounded-md px-1 -mx-1 py-0.5 transition-colors">
      {content}
    </a>
  ) : (
    <div className="flex items-center gap-2 px-1 -mx-1 py-0.5">{content}</div>
  );
}
