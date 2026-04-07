export const BUSINESS_IMAGES_BUCKET = 'business-images';
export const BUSINESS_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const BUSINESS_IMAGE_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type BusinessImageKind = 'logo' | 'storefront';

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildBusinessImagePath(
  businessId: string,
  kind: BusinessImageKind,
  fileName: string
) {
  const normalizedName = sanitizeFileName(fileName || 'image');
  const uniqueId = crypto.randomUUID();
  return `${businessId}/${kind}/${uniqueId}-${normalizedName}`;
}

export function isAllowedBusinessImageType(type: string) {
  return BUSINESS_IMAGE_ALLOWED_TYPES.includes(type as (typeof BUSINESS_IMAGE_ALLOWED_TYPES)[number]);
}
