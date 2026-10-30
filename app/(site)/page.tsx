'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import CdnImage from '@/components/yd/CdnImage';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { hanhala } from '@/data/hanhala';
import { dict } from '@/lib/yd/dict';
import { useLang } from '@/lib/yd/lang';
import {
  DONATE, CHARITY_EXTRA, SOCIAL, G, Portrait, cssVars, prefersReducedMotion,
  useFitText, useMagnetic, useMotion, useSharedMotion, useStaffName,
} from '@/components/yd/core';

gsap.registerPlugin(ScrollTrigger);

type W = keyof typeof dict.en.words;
type Pic = { src: string; pos?: string; w: W; shape?: 'tall' | 'sq' };

// Hero: a slow cinematic crossfade of real photos (full colour, warm grade).
// pos = object-position, chosen so faces stay in frame on a tall phone crop.
const heroSlides: Pic[] = [
  { src: G + 'photo-2.png', pos: '50% 35%', w: 'achdus' },
  { src: G + 'photo-11.png', pos: '48% 40%', w: 'torah' },
  { src: G + 'shabbos-1.jpg', pos: '58% 45%', w: 'shabbos' },
  { src: G + 'photo-3.png', pos: '50% 35%', w: 'chavrusa' },
  { src: G + 'photo-13.png', pos: '30% 40%', w: 'simcha' },
];

// The centrepiece: three columns of photos drifting at different speeds (phones show two).
const riverCols: Pic[][] = [
  [
    { src: G + 'photo-8.png', pos: '50% 35%', w: 'torahStudy', shape: 'tall' },
    { src: G + 'photo-15.png', w: 'simcha', shape: 'sq' },
    { src: G + 'photo-19.png', pos: '55% 50%', w: 'brotherhood', shape: 'tall' },
    { src: G + 'bochurim-1.jpg', w: 'beisMedrash', shape: 'sq' },
    { src: G + 'rabbi-liff-teaching.jpg', pos: '45% 50%', w: 'shiurim', shape: 'tall' },
  ],
  [
    { src: G + 'photo-9.png', pos: '50% 35%', w: 'guidance', shape: 'sq' },
    { src: G + 'photo-4.png', pos: '62% 50%', w: 'chavrusa', shape: 'tall' },
    { src: G + 'photo-20.png', w: 'torahStudy', shape: 'sq' },
    { src: G + 'photo-10.png', pos: '40% 50%', w: 'shiurim', shape: 'tall' },
    { src: G + 'photo-13.png', pos: '45% 40%', w: 'achdus', shape: 'sq' },
  ],
  [
    { src: G + 'photo-2.png', w: 'achdus', shape: 'tall' },
    { src: G + 'shabbos-1.jpg', w: 'shabbos', shape: 'sq' },
    { src: G + 'photo-11.png', w: 'torah', shape: 'tall' },
    { src: G + 'photo-16.png', w: 'chavrusa', shape: 'sq' },
  ],
];

// A pinned stack: each photo rises over the last as you scroll.
const stack: Pic[] = [
  { src: G + 'photo-6.png', pos: '50% 50%', w: 'shiurim' },
  { src: G + 'photo-5.png', pos: '50% 40%', w: 'torahStudy' },
  { src: G + 'beis-medrash-seder.jpg', pos: '55% 50%', w: 'beisMedrash' },
  { src: G + 'photo-1.png', pos: '62% 45%', w: 'chavrusa' },
  { src: G + 'photo-16.png', pos: '50% 45%', w: 'achdus' },
];

// "Life at the yeshiva" reel.
const reel: Pic[] = [
  { src: G + 'photo-3.png', pos: '50% 40%', w: 'chavrusa' },
  { src: G + 'photo-12.png', pos: '45% 50%', w: 'shiurim' },
  { src: G + 'photo-2.png', pos: '50% 40%', w: 'achdus' },
  { src: G + 'shabbos-1.jpg', pos: '58% 50%', w: 'shabbos' },
  { src: G + 'photo-13.png', pos: '40% 40%', w: 'simcha' },
  { src: G + 'photo-11.png', pos: '50% 45%', w: 'torah' },
];

const marqueeWords: W[] = ['torahStudy', 'shiurim', 'achdus', 'shabbos', 'guidance', 'brotherhood'];

// The settings file still holds a placeholder video (not a real shiur); never show it.
const PLACEHOLDER_VIDEOS = ['dQw4w9WgXcQ'];
function toEmbedUrl(url: string): string {
  if (!url) return '';
  const m = url.match(/embed\/([a-zA-Z0-9_-]{11})/) || url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) || url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  const id = m ? m[1] : '';
  if (!id || PLACEHOLDER_VIDEOS.includes(id)) return '';
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
}
function videoId(embedUrl: string): string {
  const m = embedUrl.match(/embed\/([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : '';
}

/** word in the page language, plus the same word in the other language as a small accent */
function useWords() {
  const { lang } = useLang();
  const other = lang === 'he' ? 'en' : 'he';
  return (w: W) => [dict[lang].words[w], dict[other].words[w]] as const;
}

// ── 00 · Hero: the motto over a slow, cinematic crossfade of real photos ──
function Hero() {
  const { t } = useLang();
  const word = useWords();
  const fitRef = useFitText(0.95);
  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState(-1);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (heroRef.current) io.observe(heroRef.current);
    const timer = window.setInterval(() => {
      if (!visible || document.hidden) return;
      setIdx((i) => {
        setPrev(i);
        return (i + 1) % heroSlides.length;
      });
    }, 5200);
    return () => {
      window.clearInterval(timer);
      io.disconnect();
    };
  }, []);

  const [cur, alt] = word(heroSlides[idx].w);
  return (
    <section ref={heroRef} className="yd-hero" aria-labelledby="yd-motto">
      <div className="yd-hero-media yd-grade" aria-hidden="true">
        {heroSlides.map((s, i) => (
          <div key={s.src} className={`yd-slide ${i === idx ? 'is-on' : ''} ${i === prev ? 'is-prev' : ''} yd-kb-${i % 3}`}>
            <CdnImage src={s.src} alt="" fill priority={i === 0} quality={62} sizes="(orientation: portrait) 165vh, 100vw" style={{ objectPosition: s.pos }} />
          </div>
        ))}
        <div className="yd-hero-shade" />
        <div className="yd-hero-grain" />
      </div>

      <div className="yd-hero-copy">
        <p className="yd-hero-kicker">
          <span>{t.meta.fullName}</span>
          <span className="yd-dot" aria-hidden="true" />
          <span>{t.meta.nick}</span>
        </p>
        <h1 id="yd-motto" className="yd-motto" aria-label={t.home.mottoAria}>
          {t.home.motto.map((line, i) => (
            <span key={line} className="yd-mline" aria-hidden="true">
              <span className="yd-rise" style={cssVars({ '--d': `${0.15 + i * 0.15}s` })}>{line}</span>
            </span>
          ))}
          <span className="yd-mline yd-mline-fit" aria-hidden="true">
            <span ref={fitRef} className="yd-fit yd-diff">
              {Array.from(t.home.mottoBig).map((c, i) => (
                <span key={i} className="yd-char" style={cssVars({ '--i': i })}>{c}</span>
              ))}
              <span className="yd-char yd-period" style={cssVars({ '--i': t.home.mottoBig.length + 2 })}>.</span>
            </span>
          </span>
        </h1>
      </div>

      <div className="yd-hero-foot">
        <div className="yd-ticks" aria-hidden="true">
          {heroSlides.map((s, i) => (
            <span key={s.src} className={`yd-tick ${i === idx ? 'is-on' : ''} ${i < idx ? 'is-done' : ''}`}>
              <i />
            </span>
          ))}
        </div>
        <p className="yd-hero-label" aria-hidden="true">
          <span className="yd-hero-num">{String(idx + 1).padStart(2, '0')}</span>
          <span key={idx} className="yd-hero-word">
            {cur} <i className="yd-accent">{alt}</i>
          </span>
        </p>
        <a href="#yd-idea" className="yd-scroll" aria-label={t.home.scroll}>
          <span className="yd-scroll-line" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { t, rtl } = useLang();
  const word = useWords();
  const staffName = useStaffName();
  const zoomWordRef = useFitText(0.9);
  const giveRef = useMagnetic<HTMLAnchorElement>(0.4);
  const rootRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const motion = useMotion();
  const [embed, setEmbed] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d: { youtubeUrl?: string }) => setEmbed(toEmbedUrl(d.youtubeUrl || '')))
      .catch(() => {});
  }, []);

  useSharedMotion(rootRef, motion);

  // ── Home-only scroll motion ──
  useEffect(() => {
    const root = rootRef.current;
    if (!motion || !root) return;
    const cleanups: (() => void)[] = [];
    const ctx = gsap.context(() => {
      // Hero: photos drift and deepen, the motto lifts away, the big word grows.
      gsap.timeline({ scrollTrigger: { trigger: '.yd-hero', start: 'top top', end: 'bottom top', scrub: true } })
        .to('.yd-hero-media', { yPercent: 18, scale: 1.08, ease: 'none' }, 0)
        .to('.yd-hero-shade', { opacity: 1, ease: 'none' }, 0)
        .to('.yd-hero-copy', { yPercent: -18, ease: 'none' }, 0)
        // the big word recedes (never grows past the screen edge)
        .to('.yd-diff', { scale: 0.9, opacity: 0.55, transformOrigin: rtl ? '100% 100%' : '0% 100%', ease: 'none' }, 0)
        .to('.yd-hero-foot', { opacity: 0, ease: 'none', duration: 0.4 }, 0);

      // Statement: words light up one by one as you scroll through it.
      gsap.fromTo('.yd-word', { opacity: 0.14 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: '.yd-statement', start: 'top 85%', end: 'bottom 45%', scrub: true } });

      // Pinned stack: each new photo rises over the last, the last sinks back.
      const stackSec = root.querySelector<HTMLElement>('.yd-stack');
      if (stackSec) {
        const cards = gsap.utils.toArray<HTMLElement>('.yd-stack-card', stackSec);
        gsap.set(cards.slice(1), { y: () => window.innerHeight, rotate: rtl ? -5 : 5 });
        const tl = gsap.timeline({ scrollTrigger: { trigger: stackSec, start: 'top top', end: 'bottom bottom', scrub: 0.5, invalidateOnRefresh: true } });
        cards.forEach((card, i) => {
          if (i === 0) return;
          const prevCard = cards[i - 1];
          const at = i - 1;
          tl.fromTo(card, { y: () => window.innerHeight, rotate: rtl ? -5 : 5 }, { y: 0, rotate: 0, ease: 'power2.out', duration: 1 }, at)
            .fromTo(card.querySelector('img'), { scale: 1.35 }, { scale: 1.06, ease: 'power2.out', duration: 1 }, at)
            .to(prevCard, { scale: 0.88, yPercent: -4, ease: 'power2.inOut', duration: 1 }, at)
            .to(prevCard.querySelector('.yd-stack-dim'), { opacity: 0.6, ease: 'none', duration: 1 }, at);
        });
        tl.to({}, { duration: 0.35 });
        gsap.fromTo('.yd-stack-bar i', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: stackSec, start: 'top top', end: 'bottom bottom', scrub: true } });
      }

      // "Inside": the word is a window; scroll and you fly through one letter into the beis medrash.
      const zoom = root.querySelector<HTMLElement>('.yd-zoom');
      const mask = root.querySelector<HTMLElement>('.yd-zoom-mask');
      const target = root.querySelector<HTMLElement>('.yd-zoom-i');
      if (zoom && mask && target) {
        const origin = () => {
          const m = mask.getBoundingClientRect();
          const r = target.getBoundingClientRect();
          const sc = (gsap.getProperty(mask, 'scale') as number) || 1;
          return `${(r.left + r.width * 0.5 - m.left) / sc}px ${(r.top + r.height * 0.55 - m.top) / sc}px`;
        };
        gsap.set(mask, { transformOrigin: origin() });
        gsap
          .timeline({
            scrollTrigger: {
              trigger: zoom, start: 'top top', end: 'bottom bottom', scrub: 0.4, invalidateOnRefresh: true,
              onRefreshInit: () => {
                gsap.set(mask, { scale: 1 });
                gsap.set(mask, { transformOrigin: origin() });
              },
            },
          })
          .fromTo('.yd-zoom-media', { scale: 1.35 }, { scale: 1, ease: 'none', duration: 1 }, 0)
          .fromTo(mask, { scale: 1 }, { scale: 90, ease: 'power3.in', duration: 0.62 }, 0.08)
          .to(mask, { autoAlpha: 0, duration: 0.08, ease: 'none' }, 0.66)
          .fromTo('.yd-zoom-shade', { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' }, 0.72)
          .fromTo('.yd-zoom-cap .yd-kicker', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.16, ease: 'power2.out' }, 0.74)
          .fromTo('.yd-zoom-h', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.18, ease: 'power2.out' }, 0.78)
          .fromTo('.yd-zoom-cap .yd-pill-link', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.16, ease: 'power2.out' }, 0.84);
      }

      // "Life at the yeshiva": a pinned reel; scroll down and the photos slide sideways (mirrored in Hebrew).
      const reelSec = root.querySelector<HTMLElement>('.yd-reel');
      const track = root.querySelector<HTMLElement>('.yd-reel-track');
      if (reelSec && track) {
        const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const setH = () => {
          reelSec.style.height = `${dist() + window.innerHeight}px`;
        };
        setH();
        ScrollTrigger.addEventListener('refreshInit', setH);
        cleanups.push(() => ScrollTrigger.removeEventListener('refreshInit', setH));
        gsap.to(track, { x: () => (rtl ? dist() : -dist()), ease: 'none', scrollTrigger: { trigger: reelSec, start: 'top top', end: 'bottom bottom', scrub: 0.5, invalidateOnRefresh: true } });
        gsap.fromTo('.yd-reel-bar i', { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: reelSec, start: 'top top', end: 'bottom bottom', scrub: true } });
        gsap.utils.toArray<HTMLElement>('.yd-reel-item img').forEach((img) => {
          gsap.fromTo(img, { xPercent: rtl ? 8 : -8 }, { xPercent: rtl ? -8 : 8, ease: 'none', scrollTrigger: { trigger: reelSec, start: 'top top', end: 'bottom bottom', scrub: true } });
        });
      }

      // Hanhala rows draw in.
      gsap.utils.toArray<HTMLElement>('.yd-row').forEach((el) => {
        gsap.from(el, { y: 24, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
      });

      // Support headline: big type that grows into the screen.
      gsap.fromTo('.yd-support-h', { scale: 0.82, transformOrigin: rtl ? '100% 50%' : '0% 50%' }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.yd-support', start: 'top bottom', end: 'top 25%', scrub: true } });
    }, root);

    document.fonts?.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
    return () => {
      cleanups.forEach((f) => f());
      ctx.revert();
    };
  }, [motion, rtl]);

  const [lead, ...rest] = hanhala;
  const roles = t.hanhala.roles;
  const iw = t.home.insideWord;

  return (
    <div ref={rootRef} className="yd-page yd-home">
      <Hero />

      {/* ── 01 · The idea ─────────────────────────────────────────── */}
      <section id="yd-idea" className="yd-idea">
        <p className="yd-kicker" data-rise>
          <span>(01)</span> {t.home.ideaK}
        </p>
        <h2 className="yd-statement">
          {t.home.statement.map(([w, em], i) => (
            <span key={i} className={`yd-word ${em ? 'yd-em' : ''}`}>
              {w}{' '}
            </span>
          ))}
        </h2>
        <div className="yd-idea-grid">
          <figure className="yd-idea-fig" data-cursor={word('guidance')[0]}>
            <div className="yd-unmask yd-grade">
              <CdnImage src={G + 'shiur-rav.jpg'} alt={t.home.altShiur} fill quality={70} sizes="(max-width: 900px) 100vw, 45vw" style={{ objectPosition: '50% 30%' }} />
            </div>
            <figcaption>
              <span>{t.home.fig}</span> {t.home.figShiur}
            </figcaption>
          </figure>
          <div className="yd-idea-text">
            <p className="yd-lede" data-rise>{t.home.lede}</p>
            <blockquote className="yd-quote" data-rise>
              <p>{t.home.quote}</p>
              <cite>{t.home.quoteBy}</cite>
            </blockquote>
          </div>
        </div>
      </section>

      {/* ── 02 · Yeshiva life, in motion (the centrepiece) ───────── */}
      <section className="yd-river" aria-labelledby="yd-river-h">
        <div className="yd-river-head">
          <p className="yd-kicker yd-kicker-light" data-rise>
            <span>(02)</span> {t.home.lifeK}
          </p>
          <h2 id="yd-river-h" className="yd-h2" data-rise>
            {t.home.lifeH} <span className="yd-accent">{t.home.lifeAccent}</span>
          </h2>
        </div>
        <p className="yd-river-big" aria-hidden="true">
          {t.home.riverBig.map((w, i) => (
            <span key={i} className={i % 2 ? 'yd-accent' : ''}>{w} </span>
          ))}
        </p>
        <div className="yd-river-cols">
          {riverCols.map((col, ci) => (
            <div key={ci} className={`yd-river-col yd-col-${ci}`} data-drift={[0.12, -0.22, 0.06][ci]}>
              {col.map((pic) => {
                const [a, b] = word(pic.w);
                return (
                  <figure key={pic.src + ci} className={`yd-river-item yd-shape-${pic.shape}`} data-cursor={a}>
                    <div className="yd-river-img yd-grade">
                      <CdnImage src={pic.src} alt={a} fill quality={65} sizes="(max-width: 900px) 50vw, 33vw" style={{ objectPosition: pic.pos || '50% 50%' }} />
                    </div>
                    <figcaption>
                      {a} <i className="yd-accent">{b}</i>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {/* ── Pinned stack: photos rise over each other ───────────── */}
      <section className="yd-stack" aria-label={t.home.momentsK}>
        <div className="yd-stack-stick">
          <p className="yd-stack-k" aria-hidden="true">
            {t.home.momentsK} <i className="yd-accent">{t.home.momentsAccent}</i>
          </p>
          {stack.map((s, i) => {
            const [a, b] = word(s.w);
            return (
              <figure key={s.src} className="yd-stack-card" style={{ zIndex: i + 1 }}>
                <div className="yd-grade yd-stack-img">
                  <CdnImage src={s.src} alt={a} fill quality={66} sizes="(max-width: 900px) 100vw, 60vw" style={{ objectPosition: s.pos }} />
                </div>
                <div className="yd-stack-dim" aria-hidden="true" />
                <figcaption>
                  <span className="yd-stack-n">
                    {String(i + 1).padStart(2, '0')}
                    <small>/{String(stack.length).padStart(2, '0')}</small>
                  </span>
                  <span className="yd-stack-l">{a}</span>
                  <i className="yd-accent">{b}</i>
                </figcaption>
              </figure>
            );
          })}
          <div className="yd-stack-bar" aria-hidden="true">
            <i />
          </div>
        </div>
      </section>

      {/* ── 03 · Inside: fly through the word into the beis medrash ── */}
      <section className="yd-zoom" aria-labelledby="yd-zoom-h">
        <div className="yd-zoom-stick">
          <div className="yd-zoom-media yd-grade">
            <CdnImage src={G + 'beis-medrash-full.jpg'} alt={t.home.altBeisMedrash} fill quality={62} sizes="(orientation: portrait) 165vh, 100vw" style={{ objectPosition: '78% 50%' }} />
          </div>
          <div className="yd-zoom-shade" aria-hidden="true" />
          <div className="yd-zoom-mask" aria-hidden="true">
            <span ref={zoomWordRef} className="yd-zoom-word yd-fit">
              {iw[0]}
              <span className="yd-zoom-i">{iw[1]}</span>
              {iw[2]}
            </span>
          </div>
          <div className="yd-zoom-cap">
            <p className="yd-kicker yd-kicker-light">
              <span>(03)</span> {t.home.insideK}
            </p>
            <h2 id="yd-zoom-h" className="yd-zoom-h">
              {t.home.insideH} <span className="yd-zoom-h2">{t.home.insideAccent}</span>
            </h2>
            <Link href="/gallery" className="yd-pill-link">
              {t.home.fullGallery} <span aria-hidden="true" className="yd-arr">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 04 · Reel: life at the yeshiva ────────────────────────── */}
      <section className="yd-reel" aria-labelledby="yd-reel-h">
        <div className="yd-reel-stick">
          <div className="yd-reel-head">
            <p className="yd-kicker yd-kicker-light">
              <span>(04)</span> {t.home.reelK}
            </p>
            <h2 id="yd-reel-h" className="yd-reel-h">
              {t.home.reelH} <span className="yd-accent-he">{t.home.reelAccent}</span>
            </h2>
          </div>
          <div className="yd-reel-track">
            {reel.map((p, i) => {
              const [a, b] = word(p.w);
              return (
                <figure key={p.src} className="yd-reel-item" data-cursor={a}>
                  <div className="yd-reel-img yd-grade">
                    <CdnImage src={p.src} alt={a} fill quality={68} sizes="(max-width: 900px) 80vw, 40vw" style={{ objectPosition: p.pos }} />
                  </div>
                  <figcaption>
                    <span className="yd-reel-n">{String(i + 1).padStart(2, '0')}</span>
                    <span className="yd-reel-l">{a}</span>
                    <i className="yd-accent">{b}</i>
                  </figcaption>
                </figure>
              );
            })}
            <Link href="/gallery" className="yd-reel-end">
              <span>{t.home.reelEnd}</span>
              <span aria-hidden="true" className="yd-reel-arrow yd-arr">→</span>
            </Link>
          </div>
          <div className="yd-reel-bar" aria-hidden="true">
            <i />
          </div>
        </div>
      </section>

      {/* ── Marquee ───────────────────────────────────────────────── */}
      <div className="yd-marquee" aria-hidden="true">
        <div className="yd-marquee-track">
          {[0, 1].map((k) => (
            <span key={k} className="yd-marquee-set">
              {marqueeWords.map((w) => {
                const [a, b] = word(w);
                return (
                  <span key={w + k} className="yd-marquee-item">
                    {a} <i className="yd-accent">{b}</i> <b>✶</b>
                  </span>
                );
              })}
            </span>
          ))}
        </div>
      </div>

      {/* ── 05 · Hanhala ─────────────────────────────────────────── */}
      <section className="yd-hanhala" aria-labelledby="yd-hanhala-h">
        <div className="yd-hanhala-head">
          <p className="yd-kicker yd-kicker-light" data-rise>
            <span>(05)</span> {t.home.leadK}
          </p>
          <h2 id="yd-hanhala-h" className="yd-h2" data-rise>
            {t.home.leadH} <span className="yd-accent">{t.home.leadAccent}</span>
          </h2>
        </div>

        <article className="yd-lead">
          <div className="yd-lead-pic" data-speed="0.12">
            <Portrait m={lead} size="lg" />
          </div>
          <div className="yd-lead-text" data-rise>
            <p className="yd-role">{roles[lead.role] || lead.role}</p>
            <h3 className="yd-lead-name">{staffName(lead)}</h3>
            <p className="yd-lead-alt">{rtl ? lead.name : lead.hebrewName}</p>
            {lead.bio && <p className="yd-lead-bio">{rtl ? dictBioShort : lead.bio}</p>}
            <Link href="/staff" className="yd-pill-link">
              {t.home.fullBios} <span aria-hidden="true" className="yd-arr">→</span>
            </Link>
          </div>
        </article>

        <ol className="yd-roster">
          {rest.map((m, i) => (
            <li key={m.slug} className="yd-row">
              <Link href={`/staff#${m.slug}`} className="yd-row-link">
                <Portrait m={m} size="sm" />
                <span className="yd-row-text">
                  <span className="yd-row-num">{String(i + 2).padStart(2, '0')}</span>
                  <span className="yd-row-name">
                    {staffName(m)}
                    {rtl && !m.hebrewName ? <em className="yd-ph-chip">{t.hanhala.hebrewNameToCome}</em> : null}
                  </span>
                  <span className="yd-row-role">{roles[m.role] || m.role}</span>
                </span>
                <span className="yd-row-he">{rtl ? m.name : m.hebrewName}</span>
                <span className="yd-row-arrow yd-arr" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 06 · Watch & follow ──────────────────────────────────── */}
      <section className="yd-watch" aria-labelledby="yd-watch-h">
        <p className="yd-kicker" data-rise>
          <span>(06)</span> {t.home.watchK}
        </p>
        <h2 id="yd-watch-h" className="yd-h2 yd-h2-dark" data-rise>
          {t.home.watchH}
        </h2>
        <div className={`yd-watch-grid ${embed ? 'has-video' : ''}`}>
          {embed && (
            <div className="yd-video" data-rise>
              {playing ? (
                <iframe
                  src={embed + '&autoplay=1'}
                  title={t.home.playLatest}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <button className="yd-video-facade" onClick={() => setPlaying(true)} data-cursor="▶">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://i.ytimg.com/vi/${videoId(embed)}/hqdefault.jpg`} alt="" loading="lazy" />
                  <span className="yd-play">
                    <span aria-hidden="true">▶</span> {t.home.playLatest}
                  </span>
                </button>
              )}
            </div>
          )}
          <div className="yd-follow">
            <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="yd-big-link" data-rise>
              <span className="yd-big-link-k">YouTube</span>
              <span className="yd-big-link-v">{t.home.youtube}</span>
              <span className="yd-arrow" aria-hidden="true">↗</span>
            </a>
            <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer" className="yd-big-link" data-rise>
              <span className="yd-big-link-k">Instagram</span>
              <span className="yd-big-link-v">{t.home.instagram}</span>
              <span className="yd-arrow" aria-hidden="true">↗</span>
            </a>
            <a href={SOCIAL.facebook} target="_blank" rel="noopener noreferrer" className="yd-big-link" data-rise>
              <span className="yd-big-link-k">Facebook</span>
              <span className="yd-big-link-v">{t.home.facebook}</span>
              <span className="yd-arrow" aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── 07 · Support ─────────────────────────────────────────── */}
      <section className="yd-support" aria-labelledby="yd-support-h">
        <div className="yd-support-bg yd-grade" data-speed="0.25" aria-hidden="true">
          <CdnImage src={G + 'photo-14.png'} alt="" fill quality={60} sizes="100vw" />
        </div>
        <div className="yd-support-in">
          <p className="yd-kicker yd-kicker-light" data-rise>
            <span>(07)</span> {t.home.supportK}
          </p>
          <h2 id="yd-support-h" className="yd-support-h">{t.home.supportH}</h2>
          <p className="yd-support-copy" data-rise>{t.home.supportCopy}</p>
          <div className="yd-support-row">
            <a ref={giveRef} href={DONATE} target="_blank" rel="noopener noreferrer" className="yd-give-orb" data-cursor={t.give.donate}>
              <span data-magnet-inner>
                {t.give.donate}
                <small>CauseMatch ↗</small>
              </span>
            </a>
            <div className="yd-support-links">
              <a href={CHARITY_EXTRA} target="_blank" rel="noopener noreferrer" className="yd-give">
                <span className="yd-give-k">{t.give.ukK}</span>
                <span className="yd-give-v">CharityExtra</span>
                <span className="yd-arrow" aria-hidden="true">↗</span>
              </a>
              <Link href="/support" className="yd-give">
                <span className="yd-give-k">{t.give.moreK}</span>
                <span className="yd-give-v">{t.give.supportPage}</span>
                <span className="yd-arrow yd-arr" aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Hebrew version of the short Rosh Yeshiva line shown on the home page.
const dictBioShort = 'בוגר ישיבת גבעת שאול. החום האמיתי והיחס האישי שלו לכל בחור קובעים את הטון של הישיבה כולה.';
