/**
 * Cloudinary URL helper
 *
 * When NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is set, converts a local image path
 * like /images/staff/rabbi-liff.jpg into the corresponding Cloudinary URL.
 *
 * We store images under the public_id prefix "ay" to keep the Cloudinary
 * library tidy:  /images/staff/rabbi-liff.jpg → ay/images/staff/rabbi-liff
 *
 * The admin panel uploads with that same public_id, so URLs are predictable
 * without any database lookup.
 */
export const CLOUDINARY_PREFIX = 'ay';

export function getImageSrc(localPath: string): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName || !localPath) return localPath;

  // Strip leading slash and extension, prepend prefix
  const withoutExt = localPath.replace(/^\//, '').replace(/\.[^.]+$/, '');
  const publicId = `${CLOUDINARY_PREFIX}/${withoutExt}`;

  // Use Cloudinary's auto-format + auto-quality for best performance
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${publicId}`;
}

/**
 * Derive the Cloudinary public_id from a local image path.
 * Used by the admin panel when uploading.
 */
export function getPublicId(localPath: string): string {
  const withoutLeadingSlash = localPath.replace(/^\//, '');
  const withoutExt = withoutLeadingSlash.replace(/\.[^.]+$/, '');
  return `${CLOUDINARY_PREFIX}/${withoutExt}`;
}
