'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useState } from 'react';
import { getImageSrc } from '@/lib/imageUrl';

/**
 * next/image that lets the /admin Image Manager override any site photo.
 *
 * For a local path like /images/gallery/photo-3.png it first tries the
 * Cloudinary upload made from /admin (ay/images/gallery/photo-3); if none
 * exists it falls back to the file shipped with the site. So an upload in
 * the admin replaces the photo on the live site immediately, no deploy.
 */
export default function CdnImage({ src, onError, ...rest }: Omit<ImageProps, 'src'> & { src: string }) {
  const candidates = [getImageSrc(src), src].filter((s, i, a) => a.indexOf(s) === i);
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [src]);
  const chosen = candidates[Math.min(idx, candidates.length - 1)];
  return (
    <Image
      {...rest}
      src={chosen}
      unoptimized={chosen.startsWith('http')}
      onError={(e) => {
        if (idx < candidates.length - 1) setIdx(idx + 1);
        else onError?.(e);
      }}
    />
  );
}
