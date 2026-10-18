import { ApiError, ok, requireApiUser, withApi } from '@/lib/api';
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, STORAGE_BUCKETS } from '@/lib/constants';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { uploadBucketSchema } from '@/lib/validations';
import { RATE_LIMITS } from '@/lib/rate-limit';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/** Check the file's magic bytes so a renamed .exe can't pass as an image. */
function matchesSignature(bytes: Uint8Array, mime: string): boolean {
  const startsWith = (...sig: number[]) => sig.every((byte, i) => bytes[i] === byte);
  switch (mime) {
    case 'image/jpeg':
      return startsWith(0xff, 0xd8, 0xff);
    case 'image/png':
      return startsWith(0x89, 0x50, 0x4e, 0x47);
    case 'image/webp':
      // "RIFF" ???? "WEBP"
      return startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    case 'application/pdf':
      return startsWith(0x25, 0x50, 0x44, 0x46);
    default:
      return false;
  }
}

/**
 * POST /api/upload  (multipart: file, bucket)
 *  - `avatars`          → any signed-in user, images only, returns the public URL
 *  - `driver-documents` → drivers only, images or PDF, stays private (returns the storage path)
 * Files are stored under `<users.id>/…` which the storage RLS policies rely on.
 */
export const POST = withApi(async (request) => {
  const user = await requireApiUser();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, 'Upload must be multipart/form-data');
  }

  const bucketResult = uploadBucketSchema.safeParse(form.get('bucket'));
  if (!bucketResult.success) throw new ApiError(400, 'Unknown upload bucket');
  const bucket = bucketResult.data;

  if (bucket === 'driver-documents' && user.role !== 'driver') {
    throw new ApiError(403, 'Only drivers can upload documents');
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) throw new ApiError(400, 'Choose a file to upload');
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(413, `File is too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB)`);
  }

  const allowed: readonly string[] =
    bucket === 'avatars' ? ALLOWED_IMAGE_TYPES : [...ALLOWED_IMAGE_TYPES, 'application/pdf'];
  if (!allowed.includes(file.type)) {
    throw new ApiError(415, bucket === 'avatars' ? 'Use a JPG, PNG or WebP image' : 'Use a JPG, PNG, WebP or PDF file');
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(buffer, file.type)) throw new ApiError(415, 'The file content does not match its type');

  const path = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${EXTENSIONS[file.type]}`;
  const bucketName = bucket === 'avatars' ? STORAGE_BUCKETS.avatars : STORAGE_BUCKETS.driverDocuments;

  const db = createSupabaseAdminClient();
  const { error } = await db.storage.from(bucketName).upload(path, buffer, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const url = bucket === 'avatars' ? db.storage.from(bucketName).getPublicUrl(path).data.publicUrl : null;
  return ok({ bucket: bucketName, path, url }, 201);
}, 'POST /api/upload', { rateLimit: RATE_LIMITS.upload });
