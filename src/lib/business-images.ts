import type { SupabaseClient } from '@supabase/supabase-js';

const BUSINESS_IMAGES_BUCKET = 'business-images';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export function validateBusinessImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file.');
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Image must be 5MB or smaller.');
  }
}

export async function uploadBusinessImage(
  supabase: SupabaseClient,
  ownerId: string,
  file: File
) {
  validateBusinessImageFile(file);

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${ownerId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUSINESS_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from(BUSINESS_IMAGES_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}
