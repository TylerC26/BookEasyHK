import type { BusinessSocialLinks } from '@/lib/types';

export const EMPTY_SOCIAL_LINKS: Required<BusinessSocialLinks> = {
  instagram: '',
  threads: '',
  facebook: '',
  other: '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeOptionalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function parseBusinessSocialLinks(value: unknown): Required<BusinessSocialLinks> {
  if (!isRecord(value)) return { ...EMPTY_SOCIAL_LINKS };

  return {
    instagram: typeof value.instagram === 'string' ? value.instagram : '',
    threads: typeof value.threads === 'string' ? value.threads : '',
    facebook: typeof value.facebook === 'string' ? value.facebook : '',
    other: typeof value.other === 'string' ? value.other : '',
  };
}

export function buildBusinessSocialLinks(links: BusinessSocialLinks): BusinessSocialLinks | null {
  const normalizedEntries = Object.entries(links)
    .map(([platform, url]) => [platform, normalizeOptionalUrl(url || '')] as const)
    .filter(([, url]) => Boolean(url));

  if (normalizedEntries.length === 0) return null;
  return Object.fromEntries(normalizedEntries);
}
