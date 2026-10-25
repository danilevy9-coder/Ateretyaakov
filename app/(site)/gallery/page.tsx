'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { galleryItems } from '@/lib/yd/dict';
import { useLang } from '@/lib/yd/lang';
import { G, PageHero, SOCIAL, useMotion, useSharedMotion } from '@/components/yd/core';

const CATS = ['All', 'Learning', 'Community', 'Events', 'Recreation'];
const SHAPES = ['tall', 'sq', 'sq', 'tall', 'tall', 'sq'];

export default function GalleryPage() {
  const { t, lang, rtl } = useLang();
  const other = lang === 'he' ? 'en' : 'he';
  const rootRef = useRef<HTMLDivElement>(null);
  const motion = useMotion();
  const [cat, setCat] = useState('All');
  const [ncols, setNcols] = useState(2);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const on = () => setNcols(mq.matches ? 3 : 2);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const items = useMemo(() => galleryItems.filter((g) => cat === 'All' || g.cat === cat), [cat]);
  const cols = useMemo(() => {
    const c: { item: (typeof galleryItems)[number]; idx: number }[][] = Array.from({ length: ncols }, () => []);
    items.forEach((item, idx) => c[idx % ncols].push({ item, idx }));
    return c;
  }, [items, ncols]);

  useSharedMotion(rootRef, motion, [cat, ncols]);

  // Lightbox keys
  useEffect(() => {
    if (open === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      const fwd = rtl ? 'ArrowLeft' : 'ArrowRight';
      const back = rtl ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === fwd) setOpen((o) => (o === null ? o : (o + 1) % items.length));
      if (e.key === back) setOpen((o) => (o === null ? o : (o - 1 + items.length) % items.length));
    };
    window.addEventListener('keydown', key);
    document.documentElement.classList.add('yd-locked');
    return () => {
      window.removeEventListener('keydown', key);
      document.documentElement.classList.remove('yd-locked');
    };
  }, [open, items.length, rtl]);

  const cur = open !== null ? items[open] : null;

  return (
    <div ref={rootRef} className="yd-page yd-gallery">
      <PageHero kicker={t.gallery.k} title={t.gallery.h} accent={t.gallery.accent} intro={t.gallery.intro} src={G + 'bochurim-2.jpg'} pos="50% 50%" />

      <section className="yd-river yd-gallery-river" aria-label={t.gallery.h}>
        <div className="yd-filters" role="tablist" aria-label={t.gallery.h}>
          {CATS.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={cat === c} className={cat === c ? 'is-on' : ''} onClick={() => setCat(c)}>
              {t.gallery.cats[c]}
            </button>
          ))}
        </div>
        <div key={`${cat}-${ncols}`} className={`yd-river-cols yd-cols-${ncols}`}>
          {cols.map((col, ci) => (
            <div key={ci} className={`yd-river-col yd-col-${ci}`} data-drift={[0.06, -0.12, 0.04][ci]}>
              {col.map(({ item, idx }) => (
                <figure key={item.src} className={`yd-river-item yd-shape-${SHAPES[idx % SHAPES.length]}`} data-cursor={item[lang]}>
                  <button type="button" className="yd-river-open" onClick={() => setOpen(idx)} aria-label={item[lang]}>
                    <div className="yd-river-img yd-grade">
                      <Image src={G + item.src} alt={item[lang]} fill quality={65} sizes="(max-width: 900px) 50vw, 33vw" />
                    </div>
                  </button>
                  <figcaption>
                    {item[lang]} <i className="yd-accent">{item[other]}</i>
                  </figcaption>
                </figure>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="yd-endband yd-endband-dark">
        <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer" className="yd-endlink" data-rise>
          <span className="yd-endlink-k">Instagram</span>
          <span className="yd-endlink-v">@liffs_yeshiva</span>
          <span className="yd-arrow" aria-hidden="true">↗</span>
        </a>
        <p className="yd-endnote" data-rise>{t.gallery.follow}</p>
        <Link href="/support" className="yd-endlink" data-rise>
          <span className="yd-endlink-k">{t.gallery.cta}</span>
          <span className="yd-endlink-v">{t.gallery.ctaLink}</span>
          <span className="yd-arrow yd-arr" aria-hidden="true">→</span>
        </Link>
      </section>

      {cur && open !== null && (
        <div className="yd-lightbox" role="dialog" aria-modal="true" aria-label={cur[lang]} data-lenis-prevent onClick={() => setOpen(null)}>
          <div className="yd-lightbox-img" onClick={(e) => e.stopPropagation()}>
            <Image key={cur.src} src={G + cur.src} alt={cur[lang]} fill quality={75} sizes="100vw" />
          </div>
          <div className="yd-lightbox-bar" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setOpen((open - 1 + items.length) % items.length)} aria-label={t.gallery.prev}>
              <span className="yd-arr">←</span>
            </button>
            <p>
              {cur[lang]} <i className="yd-accent">{cur[other]}</i>
              <small>{open + 1} / {items.length}</small>
            </p>
            <button type="button" onClick={() => setOpen((open + 1) % items.length)} aria-label={t.gallery.next}>
              <span className="yd-arr">→</span>
            </button>
          </div>
          <button type="button" className="yd-lightbox-close" onClick={() => setOpen(null)}>
            {t.gallery.close} ×
          </button>
        </div>
      )}
    </div>
  );
}
