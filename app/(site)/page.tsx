'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bricolage_Grotesque, Inter_Tight, Frank_Ruhl_Libre } from 'next/font/google';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { hanhala, type HanhalaMember } from '@/data/hanhala';
import './home.css';

gsap.registerPlugin(ScrollTrigger);

// ── Type: one display face, one clean sans, one Hebrew serif for accents ──
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['opsz', 'wdth'],
  variable: '--yd-display',
  display: 'swap',
});
const sans = Inter_Tight({ subsets: ['latin'], variable: '--yd-sans', display: 'swap' });
const hebrew = Frank_Ruhl_Libre({
  subsets: ['hebrew'],
  weight: ['400', '700'],
  variable: '--yd-hebrew',
  display: 'swap',
});

const G = '/images/gallery/';

// Hero: a slow cinematic crossfade of real photos (full colour, warm grade).
// pos = object-position, chosen so faces stay in frame on a tall phone crop.
const heroSlides = [
  { src: G + 'photo-2.png', pos: '50% 35%', label: 'Achdus', he: 'אחדות' },
  { src: G + 'photo-11.png', pos: '48% 40%', label: 'Torah', he: 'תורה' },
  { src: G + 'shabbos-1.jpg', pos: '58% 45%', label: 'Shabbos', he: 'שבת' },
  { src: G + 'photo-3.png', pos: '50% 35%', label: 'Chavrusa', he: 'חברותא' },
  { src: G + 'photo-13.png', pos: '30% 40%', label: 'Simcha', he: 'שמחה' },
];

// "Life at the yeshiva" reel. Labels are the ones the current site already uses.
const reel = [
  { src: G + 'photo-3.png', pos: '50% 40%', label: 'Chavrusa', he: 'חברותא' },
  { src: G + 'photo-12.png', pos: '45% 50%', label: 'Shiurim', he: 'שיעורים' },
  { src: G + 'photo-2.png', pos: '50% 40%', label: 'Achdus', he: 'אחדות' },
  { src: G + 'shabbos-1.jpg', pos: '58% 50%', label: 'Shabbos', he: 'שבת' },
  { src: G + 'photo-13.png', pos: '40% 40%', label: 'Simcha', he: 'שמחה' },
  { src: G + 'photo-11.png', pos: '50% 45%', label: 'Torah', he: 'תורה' },
];

// "Yeshiva life in motion": three columns of photos drifting at different speeds.
// On a phone the first two columns show; desktop adds the third.
type Pic = { src: string; pos?: string; label: string; he: string; shape: 'tall' | 'sq' | 'wide' };
const riverCols: Pic[][] = [
  [
    { src: G + 'photo-8.png', pos: '50% 35%', label: 'Torah Study', he: 'לימוד תורה', shape: 'tall' },
    { src: G + 'photo-15.png', label: 'Simcha', he: 'שמחה', shape: 'sq' },
    { src: G + 'photo-19.png', pos: '55% 50%', label: 'Brotherhood', he: 'אחווה', shape: 'tall' },
    { src: G + 'bochurim-1.jpg', label: 'Beis medrash', he: 'בית מדרש', shape: 'sq' },
    { src: G + 'rabbi-liff-teaching.jpg', pos: '45% 50%', label: 'Shiurim', he: 'שיעורים', shape: 'tall' },
  ],
  [
    { src: G + 'photo-9.png', pos: '50% 35%', label: 'Guidance', he: 'הדרכה', shape: 'sq' },
    { src: G + 'photo-4.png', pos: '62% 50%', label: 'Chavrusa', he: 'חברותא', shape: 'tall' },
    { src: G + 'photo-20.png', label: 'Torah Study', he: 'לימוד תורה', shape: 'sq' },
    { src: G + 'photo-10.png', pos: '40% 50%', label: 'Shiurim', he: 'שיעורים', shape: 'tall' },
    { src: G + 'photo-13.png', pos: '45% 40%', label: 'Achdus', he: 'אחדות', shape: 'sq' },
  ],
  [
    { src: G + 'photo-2.png', label: 'Achdus', he: 'אחדות', shape: 'tall' },
    { src: G + 'shabbos-1.jpg', label: 'Shabbos', he: 'שבת', shape: 'sq' },
    { src: G + 'photo-11.png', label: 'Torah', he: 'תורה', shape: 'tall' },
    { src: G + 'photo-16.png', label: 'Chavrusa', he: 'חברותא', shape: 'sq' },
  ],
];

// A pinned stack: each photo rises over the last as you scroll.
const stack = [
  { src: G + 'photo-6.png', pos: '50% 50%', label: 'Shiurim', he: 'שיעורים' },
  { src: G + 'photo-5.png', pos: '50% 40%', label: 'Torah Study', he: 'לימוד תורה' },
  { src: G + 'photo-17.png', pos: '50% 50%', label: 'Beis medrash', he: 'בית מדרש' },
  { src: G + 'photo-1.png', pos: '62% 45%', label: 'Chavrusa', he: 'חברותא' },
  { src: G + 'photo-16.png', pos: '50% 45%', label: 'Achdus', he: 'אחדות' },
];

const marqueeWords = [
  ['Torah Study', 'תורה'],
  ['Shiurim', 'שיעורים'],
  ['Achdus', 'אחדות'],
  ['Shabbos', 'שבת'],
  ['Guidance', 'הדרכה'],
  ['Brotherhood', 'אחווה'],
];

// The statement, word by word (em = set in the display face).
const statement: [string, boolean][] = [
  ['Every', false], ['bochur', false], ['is', false], ['seen,', true], ['shaped,', true],
  ['and', false], ['sent', true], ['forth', true], ['to', false], ['lead.', false],
];

const DONATE = 'https://causematch.com/yay';
// The settings file still holds a placeholder video (not a real shiur); never show it.
const PLACEHOLDER_VIDEOS = ['dQw4w9WgXcQ'];

function toEmbedUrl(url: string): string {
  if (!url) return '';
  let id = '';
  const embed = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  id = (embed && embed[1]) || (short && short[1]) || (watch && watch[1]) || '';
  if (!id || PLACEHOLDER_VIDEOS.includes(id)) return '';
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
}

function videoId(embedUrl: string): string {
  const m = embedUrl.match(/embed\/([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : '';
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── Fit one line of type to the full width of its container ──
function useFitText(ratio = 0.97) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const line = el.parentElement as HTMLElement;
    const fit = () => {
      const avail = line.clientWidth;
      let size = 100;
      for (let i = 0; i < 2; i++) {
        el.style.fontSize = `${size}px`;
        const w = el.getBoundingClientRect().width;
        if (!(w > 0 && avail > 0)) return;
        size = Math.floor((size * ratio * avail) / w);
      }
      el.style.fontSize = `${size}px`;
    };
    fit();
    document.fonts?.ready.then(fit).catch(() => {});
    document.fonts?.addEventListener?.('loadingdone', fit);
    const timers = [300, 1200, 3000].map((t) => window.setTimeout(fit, t));
    const ro = new ResizeObserver(fit);
    ro.observe(line);
    return () => {
      ro.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      document.fonts?.removeEventListener?.('loadingdone', fit);
    };
  }, [ratio]);
  return ref;
}

// ── Magnetic pull toward the pointer (mouse only; touch gets a press state in CSS) ──
function useMagnetic<T extends HTMLElement>(strength = 0.35) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia('(pointer: fine)').matches || prefersReducedMotion()) return;
    const inner = el.querySelector<HTMLElement>('[data-magnet-inner]');
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      gsap.to(el, { x: x * strength, y: y * strength, duration: 0.5, ease: 'power3.out' });
      if (inner) gsap.to(inner, { x: x * strength * 0.5, y: y * strength * 0.5, duration: 0.5, ease: 'power3.out' });
    };
    const leave = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
      if (inner) gsap.to(inner, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
    };
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', leave);
    return () => {
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseleave', leave);
    };
  }, [strength]);
  return ref;
}

// ── A small label cursor that follows the mouse over [data-cursor] items (desktop only) ──
function LabelCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const el = ref.current;
    if (!el) return;
    el.style.display = 'block';
    let x = -100, y = -100, cx = -100, cy = -100, raf = 0;
    const move = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      const t = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-cursor]');
      setLabel(t ? t.dataset.cursor || '' : '');
    };
    const tick = () => {
      cx += (x - cx) * 0.22;
      cy += (y - cy) * 0.22;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', move, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', move);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} className={`yd-cursor ${label ? 'has-label' : ''}`} aria-hidden="true">
      <span>{label}</span>
    </div>
  );
}

// ── Portrait slot: real photo when set, designed placeholder until then ──
function Portrait({ m, size }: { m: HanhalaMember; size: 'lg' | 'sm' }) {
  return (
    <div className={`yd-portrait yd-portrait-${size}`}>
      {m.photo ? (
        <Image
          src={m.photo}
          alt={m.name}
          fill
          sizes={size === 'lg' ? '(max-width: 900px) 90vw, 40vw' : '120px'}
          className="yd-portrait-img"
        />
      ) : (
        <div className="yd-portrait-ph" role="img" aria-label={`${m.name}, photo to come`}>
          <span className="yd-ph-name" aria-hidden="true">{m.surname}</span>
          <span className="yd-ph-tag">Photo to come</span>
        </div>
      )}
    </div>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const donateRef = useMagnetic<HTMLAnchorElement>(0.3);
  useEffect(() => {
    document.documentElement.classList.toggle('yd-locked', open);
    return () => document.documentElement.classList.remove('yd-locked');
  }, [open]);
  const links = [
    { n: '01', href: '/staff', label: 'Hanhala', he: 'הנהלה' },
    { n: '02', href: '/gallery', label: 'Gallery', he: 'גלריה' },
    { n: '03', href: '/support', label: 'Support', he: 'תמיכה' },
  ];
  return (
    <>
      <header className="yd-header">
        <Link href="/" className="yd-mark" aria-label="Yeshiva Ateret Yaakov, home">
          <span className="yd-mark-star" aria-hidden="true">✶</span>
          <span>Ateret Yaakov</span>
        </Link>
        <nav className="yd-nav" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              <sup>{l.n}</sup>
              {l.label}
            </Link>
          ))}
        </nav>
        <button
          className={`yd-menu-btn ${open ? 'is-open' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="yd-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          <span className="yd-burger" aria-hidden="true">
            <i />
            <i />
          </span>
        </button>
      </header>
      <a
        ref={donateRef}
        className="yd-donate"
        href={DONATE}
        target="_blank"
        rel="noopener noreferrer"
        data-cursor="Give"
      >
        <span data-magnet-inner>
          Donate <span aria-hidden="true">↗</span>
        </span>
      </a>
      <div id="yd-menu" className={`yd-menu ${open ? 'is-open' : ''}`} aria-hidden={!open} data-lenis-prevent>
        <ul>
          {links.map((l, i) => (
            <li key={l.href} style={{ ['--i' as string]: i } as CSSProperties}>
              <Link href={l.href} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
                <sup>{l.n}</sup>
                <span className="yd-menu-word">{l.label}</span>
                <i className="yd-he">{l.he}</i>
              </Link>
            </li>
          ))}
          <li style={{ ['--i' as string]: 3 } as CSSProperties}>
            <a href={DONATE} target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>
              <sup>04</sup>
              <span className="yd-menu-word yd-menu-give">Donate ↗</span>
            </a>
          </li>
        </ul>
        <div className="yd-menu-foot">
          <p className="yd-he">ישיבת עטרת יעקב</p>
          <p>
            <a href="https://www.instagram.com/liffs_yeshiva/" target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>Instagram</a>
            {' · '}
            <a href="https://www.youtube.com/@ישיבתעטרתיעקב" target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>YouTube</a>
            {' · '}
            <a href="https://www.facebook.com/liffsyeshiva/" target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>Facebook</a>
          </p>
        </div>
      </div>
    </>
  );
}

// ── 00 · Hero: the motto over a slow, cinematic crossfade of real photos ──
function Hero() {
  const fitRef = useFitText(0.99);
  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState(-1);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (heroRef.current) io.observe(heroRef.current);
    const t = window.setInterval(() => {
      if (!visible || document.hidden) return;
      setIdx((i) => {
        setPrev(i);
        return (i + 1) % heroSlides.length;
      });
    }, 5200);
    return () => {
      window.clearInterval(t);
      io.disconnect();
    };
  }, []);

  const word = 'difference';
  return (
    <section ref={heroRef} className="yd-hero" aria-labelledby="yd-motto">
      <div className="yd-hero-media yd-grade" aria-hidden="true">
        {heroSlides.map((s, i) => (
          <div
            key={s.src}
            className={`yd-slide ${i === idx ? 'is-on' : ''} ${i === prev ? 'is-prev' : ''} yd-kb-${i % 3}`}
          >
            <Image
              src={s.src}
              alt=""
              fill
              priority={i === 0}
              quality={62}
              sizes="(orientation: portrait) 165vh, 100vw"
              style={{ objectPosition: s.pos }}
            />
          </div>
        ))}
        <div className="yd-hero-shade" />
        <div className="yd-hero-grain" />
      </div>

      <div className="yd-hero-copy">
        <p className="yd-hero-kicker">
          <span className="yd-he" lang="he" dir="rtl">ישיבת עטרת יעקב</span>
          <span className="yd-dot" aria-hidden="true" />
          <span>Liff&rsquo;s Yeshiva</span>
        </p>
        <h1 id="yd-motto" className="yd-motto">
          <span className="yd-mline">
            <span className="yd-rise" style={{ ['--d' as string]: '0.15s' } as CSSProperties}>A yeshiva</span>
          </span>
          <span className="yd-mline">
            <span className="yd-rise" style={{ ['--d' as string]: '0.3s' } as CSSProperties}>with a</span>
          </span>
          <span className="yd-mline yd-mline-fit">
            <span ref={fitRef} className="yd-fit yd-diff" aria-label="difference.">
              {word.split('').map((c, i) => (
                <span key={i} className="yd-char" style={{ ['--i' as string]: i } as CSSProperties} aria-hidden="true">
                  {c}
                </span>
              ))}
              <span className="yd-char yd-period" style={{ ['--i' as string]: word.length + 2 } as CSSProperties} aria-hidden="true">
                .
              </span>
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
            {heroSlides[idx].label} <i className="yd-he">{heroSlides[idx].he}</i>
          </span>
        </p>
        <a href="#yd-idea" className="yd-scroll" aria-label="Scroll down">
          <span className="yd-scroll-line" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

export default function HomePage() {
  const footFitRef = useFitText();
  const zoomWordRef = useFitText(0.9);
  const giveRef = useMagnetic<HTMLAnchorElement>(0.4);
  const rootRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [motion, setMotion] = useState(false);
  const [embed, setEmbed] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d: { youtubeUrl?: string }) => setEmbed(toEmbedUrl(d.youtubeUrl || '')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMotion(!prefersReducedMotion());
  }, []);

  // ── Scroll-driven motion (GSAP ScrollTrigger; Lenis smooth-scroll runs in the site layout) ──
  useEffect(() => {
    const root = rootRef.current;
    if (!motion || !root) return;
    ScrollTrigger.config({ ignoreMobileResize: true });
    const cleanups: (() => void)[] = [];

    const ctx = gsap.context(() => {
      // Hero: photos drift and deepen, the motto lifts away, "difference." grows.
      gsap.timeline({
        scrollTrigger: { trigger: '.yd-hero', start: 'top top', end: 'bottom top', scrub: true },
      })
        .to('.yd-hero-media', { yPercent: 18, scale: 1.08, ease: 'none' }, 0)
        .to('.yd-hero-shade', { opacity: 1, ease: 'none' }, 0)
        .to('.yd-hero-copy', { yPercent: -18, ease: 'none' }, 0)
        .to('.yd-diff', { scale: 1.22, transformOrigin: '0% 100%', ease: 'none' }, 0)
        .to('.yd-hero-foot', { opacity: 0, ease: 'none', duration: 0.4 }, 0);

      // Statement: words light up one by one as you scroll through it.
      gsap.fromTo(
        '.yd-word',
        { opacity: 0.14 },
        {
          opacity: 1,
          stagger: 0.1,
          ease: 'none',
          scrollTrigger: { trigger: '.yd-statement', start: 'top 85%', end: 'bottom 45%', scrub: true },
        }
      );

      // Images that unmask and settle as they enter.
      gsap.utils.toArray<HTMLElement>('.yd-unmask').forEach((el) => {
        const img = el.querySelector('img');
        gsap.fromTo(
          el,
          { clipPath: 'inset(14% 12% 14% 12% round 28px)' },
          {
            clipPath: 'inset(0% 0% 0% 0% round 0px)',
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 35%', scrub: true },
          }
        );
        if (img)
          gsap.fromTo(
            img,
            { scale: 1.3 },
            { scale: 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } }
          );
      });

      // Parallax depth on anything marked with data-speed.
      gsap.utils.toArray<HTMLElement>('[data-speed]').forEach((el) => {
        const s = parseFloat(el.dataset.speed || '0');
        gsap.fromTo(
          el,
          { yPercent: -s * 50 },
          { yPercent: s * 50, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } }
        );
      });

      // Fade-and-rise for small blocks.
      gsap.utils.toArray<HTMLElement>('[data-rise]').forEach((el) => {
        gsap.from(el, {
          y: 40,
          opacity: 0,
          duration: 1.1,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        });
      });

      // ── The centrepiece: photos that keep moving as you scroll ──
      // Columns drift at different speeds (parallax depth)...
      gsap.utils.toArray<HTMLElement>('.yd-river-col').forEach((col) => {
        const s = parseFloat(col.dataset.drift || '0');
        gsap.fromTo(
          col,
          { y: () => s * window.innerHeight },
          {
            y: () => -s * window.innerHeight,
            ease: 'none',
            scrollTrigger: { trigger: '.yd-river', start: 'top bottom', end: 'bottom top', scrub: 0.3, invalidateOnRefresh: true },
          }
        );
      });
      // ...and every photo rises and scales in as it arrives, its image settling inside the frame.
      gsap.utils.toArray<HTMLElement>('.yd-river-item').forEach((el) => {
        const img = el.querySelector('img');
        gsap.fromTo(
          el,
          { scale: 0.78, opacity: 0.2, rotate: () => (Math.random() - 0.5) * 6 },
          {
            scale: 1,
            opacity: 1,
            rotate: 0,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 100%', end: 'top 55%', scrub: 0.3 },
          }
        );
        if (img)
          gsap.fromTo(
            img,
            { scale: 1.4, yPercent: -6 },
            { scale: 1.05, yPercent: 6, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } }
          );
      });
      gsap.fromTo(
        '.yd-river-big',
        { xPercent: 8 },
        { xPercent: -30, ease: 'none', scrollTrigger: { trigger: '.yd-river', start: 'top bottom', end: 'bottom top', scrub: true } }
      );

      // A pinned stack: each new photo rises over the last, the last sinks back.
      const stackSec = root.querySelector<HTMLElement>('.yd-stack');
      if (stackSec) {
        const cards = gsap.utils.toArray<HTMLElement>('.yd-stack-card', stackSec);
        gsap.set(cards.slice(1), { y: () => window.innerHeight, rotate: 5 });
        const tl = gsap.timeline({
          scrollTrigger: { trigger: stackSec, start: 'top top', end: 'bottom bottom', scrub: 0.5, invalidateOnRefresh: true },
        });
        cards.forEach((card, i) => {
          if (i === 0) return;
          const prevCard = cards[i - 1];
          const at = i - 1;
          tl.fromTo(card, { y: () => window.innerHeight, rotate: 5 }, { y: 0, rotate: 0, ease: 'power2.out', duration: 1 }, at)
            .fromTo(card.querySelector('img'), { scale: 1.35 }, { scale: 1.06, ease: 'power2.out', duration: 1 }, at)
            .to(prevCard, { scale: 0.88, yPercent: -4, ease: 'power2.inOut', duration: 1 }, at)
            .to(prevCard.querySelector('.yd-stack-dim'), { opacity: 0.6, ease: 'none', duration: 1 }, at);
        });
        tl.to({}, { duration: 0.35 });
        gsap.fromTo(
          '.yd-stack-bar i',
          { scaleY: 0 },
          { scaleY: 1, ease: 'none', scrollTrigger: { trigger: stackSec, start: 'top top', end: 'bottom bottom', scrub: true } }
        );
      }

      // "Inside": the word is a window; scroll and you fly through the I into the beis medrash.
      const zoom = root.querySelector<HTMLElement>('.yd-zoom');
      const mask = root.querySelector<HTMLElement>('.yd-zoom-mask');
      const iEl = root.querySelector<HTMLElement>('.yd-zoom-i');
      if (zoom && mask && iEl) {
        const origin = () => {
          const m = mask.getBoundingClientRect();
          const r = iEl.getBoundingClientRect();
          // gsap may already have scaled the mask; undo that to get layout coordinates
          const sc = (gsap.getProperty(mask, 'scale') as number) || 1;
          const ox = (r.left + r.width * 0.5 - m.left) / sc;
          const oy = (r.top + r.height * 0.55 - m.top) / sc;
          return `${ox}px ${oy}px`;
        };
        gsap.set(mask, { transformOrigin: origin() });
        gsap
          .timeline({
            scrollTrigger: {
              trigger: zoom,
              start: 'top top',
              end: 'bottom bottom',
              scrub: 0.4,
              invalidateOnRefresh: true,
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

      // "Life at the yeshiva": a pinned reel; scroll down and the photos slide sideways.
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
        gsap.to(track, {
          x: () => -dist(),
          ease: 'none',
          scrollTrigger: { trigger: reelSec, start: 'top top', end: 'bottom bottom', scrub: 0.5, invalidateOnRefresh: true },
        });
        gsap.fromTo(
          '.yd-reel-bar i',
          { scaleX: 0 },
          { scaleX: 1, ease: 'none', scrollTrigger: { trigger: reelSec, start: 'top top', end: 'bottom bottom', scrub: true } }
        );
        gsap.utils.toArray<HTMLElement>('.yd-reel-item img').forEach((img) => {
          gsap.fromTo(
            img,
            { xPercent: -8 },
            { xPercent: 8, ease: 'none', scrollTrigger: { trigger: reelSec, start: 'top top', end: 'bottom bottom', scrub: true } }
          );
        });
      }

      // Hanhala rows draw in.
      gsap.utils.toArray<HTMLElement>('.yd-row').forEach((el) => {
        gsap.from(el, {
          y: 24,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        });
      });

      // Support headline: big type that grows into the screen.
      gsap.fromTo(
        '.yd-support-h',
        { scale: 0.82, transformOrigin: '0% 50%' },
        { scale: 1, ease: 'none', scrollTrigger: { trigger: '.yd-support', start: 'top bottom', end: 'top 25%', scrub: true } }
      );
    }, root);

    // Fonts and images change heights: re-measure once things settle.
    const timers = [400, 1500, 3500].map((t) => window.setTimeout(() => ScrollTrigger.refresh(), t));
    document.fonts?.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      cleanups.forEach((f) => f());
      ctx.revert();
    };
  }, [motion]);

  const [lead, ...rest] = hanhala;
  const year = new Date().getFullYear();

  return (
    <div
      ref={rootRef}
      className={`yd ${motion ? 'yd-motion' : ''} ${display.variable} ${sans.variable} ${hebrew.variable}`}
    >
      <LabelCursor />
      <Header />
      <Hero />

      {/* ── 01 · The idea ─────────────────────────────────────────── */}
      <section id="yd-idea" className="yd-idea">
        <p className="yd-kicker" data-rise>
          <span>(01)</span> The idea
        </p>
        <h2 className="yd-statement">
          {statement.map(([w, em], i) => (
            <span key={i} className={`yd-word ${em ? 'yd-em' : ''}`}>
              {w}{' '}
            </span>
          ))}
        </h2>
        <div className="yd-idea-grid">
          <figure className="yd-idea-fig" data-cursor="Guidance">
            <div className="yd-unmask yd-grade">
              <Image src={G + 'photo-12.png'} alt="A shiur at the yeshiva" fill quality={70} sizes="(max-width: 900px) 100vw, 45vw" />
            </div>
            <figcaption>
              <span>Fig. 01</span> Guidance <i className="yd-he">הדרכה</i>
            </figcaption>
          </figure>
          <div className="yd-idea-text">
            <p className="yd-lede" data-rise>
              From morning seder to late-night chavrusa, every moment is an opportunity to grow in Torah and become
              the best version of yourself.
            </p>
            <blockquote className="yd-quote" data-rise>
              <p>
                &ldquo;Every bochur who walks through our doors carries the potential for greatness. Our job is to help
                them discover it.&rdquo;
              </p>
              <cite>Rabbi Yehoshua Liff</cite>
            </blockquote>
          </div>
        </div>
      </section>

      {/* ── 02 · Yeshiva life, in motion (the centrepiece) ───────── */}
      <section className="yd-river" aria-labelledby="yd-river-h">
        <div className="yd-river-head">
          <p className="yd-kicker yd-kicker-light" data-rise>
            <span>(02)</span> Yeshiva life
          </p>
          <h2 id="yd-river-h" className="yd-h2" data-rise>
            Life here <span className="yd-he">חיי ישיבה</span>
          </h2>
        </div>
        <p className="yd-river-big" aria-hidden="true">
          Torah <span className="yd-he">תורה</span> Achdus <span className="yd-he">אחדות</span> Simcha
        </p>
        <div className="yd-river-cols">
          {riverCols.map((col, ci) => (
            <div key={ci} className={`yd-river-col yd-col-${ci}`} data-drift={[0.12, -0.22, 0.06][ci]}>
              {col.map((pic) => (
                <figure key={pic.src + ci} className={`yd-river-item yd-shape-${pic.shape}`} data-cursor={pic.label}>
                  <div className="yd-river-img yd-grade">
                    <Image
                      src={pic.src}
                      alt={pic.label}
                      fill
                      quality={65}
                      sizes="(max-width: 900px) 50vw, 33vw"
                      style={{ objectPosition: pic.pos || '50% 50%' }}
                    />
                  </div>
                  <figcaption>
                    {pic.label} <i className="yd-he">{pic.he}</i>
                  </figcaption>
                </figure>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── Pinned stack: photos rise over each other ───────────── */}
      <section className="yd-stack" aria-label="Moments at the yeshiva">
        <div className="yd-stack-stick">
          <p className="yd-stack-k" aria-hidden="true">
            <span className="yd-he">רגעים</span> Moments
          </p>
          {stack.map((s, i) => (
            <figure key={s.src} className="yd-stack-card" style={{ zIndex: i + 1 }}>
              <div className="yd-grade yd-stack-img">
                <Image src={s.src} alt={s.label} fill quality={66} sizes="(max-width: 900px) 100vw, 60vw" style={{ objectPosition: s.pos }} />
              </div>
              <div className="yd-stack-dim" aria-hidden="true" />
              <figcaption>
                <span className="yd-stack-n">{String(i + 1).padStart(2, '0')}<small>/{String(stack.length).padStart(2, '0')}</small></span>
                <span className="yd-stack-l">{s.label}</span>
                <i className="yd-he">{s.he}</i>
              </figcaption>
            </figure>
          ))}
          <div className="yd-stack-bar" aria-hidden="true">
            <i />
          </div>
        </div>
      </section>

      {/* ── 03 · Inside: fly through the word into the beis medrash ── */}
      <section className="yd-zoom" aria-labelledby="yd-zoom-h">
        <div className="yd-zoom-stick">
          <div className="yd-zoom-media yd-grade">
            <Image src={G + 'bochurim-2.jpg'} alt="The beis medrash, full" fill quality={62} sizes="(orientation: portrait) 165vh, 100vw" />
          </div>
          <div className="yd-zoom-shade" aria-hidden="true" />
          <div className="yd-zoom-mask" aria-hidden="true">
            <span ref={zoomWordRef} className="yd-zoom-word yd-fit">
              <span className="yd-zoom-i">I</span>NSIDE
            </span>
          </div>
          <div className="yd-zoom-cap">
            <p className="yd-kicker yd-kicker-light">
              <span>(03)</span> Inside
            </p>
            <h2 id="yd-zoom-h" className="yd-zoom-h">
              Inside the <span className="yd-he">בית מדרש</span>
            </h2>
            <Link href="/gallery" className="yd-pill-link">
              Full gallery <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 03 · Reel: life at the yeshiva ────────────────────────── */}
      <section className="yd-reel" aria-labelledby="yd-reel-h">
        <div className="yd-reel-stick">
          <div className="yd-reel-head">
            <p className="yd-kicker yd-kicker-light">
              <span>(04)</span> Life at the yeshiva
            </p>
            <h2 id="yd-reel-h" className="yd-reel-h">
              A day <span className="yd-he">בישיבה</span>
            </h2>
          </div>
          <div className="yd-reel-track">
            {reel.map((p, i) => (
              <figure key={p.src} className="yd-reel-item" data-cursor={p.label}>
                <div className="yd-reel-img yd-grade">
                  <Image src={p.src} alt={p.label} fill quality={70} sizes="(max-width: 900px) 80vw, 40vw" style={{ objectPosition: p.pos }} />
                </div>
                <figcaption>
                  <span className="yd-reel-n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="yd-reel-l">{p.label}</span>
                  <i className="yd-he">{p.he}</i>
                </figcaption>
              </figure>
            ))}
            <Link href="/gallery" className="yd-reel-end">
              <span>See the full gallery</span>
              <span aria-hidden="true" className="yd-reel-arrow">→</span>
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
              {marqueeWords.map(([en, he]) => (
                <span key={en + k} className="yd-marquee-item">
                  {en} <i className="yd-he">{he}</i> <b>✶</b>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── 04 · Hanhala ─────────────────────────────────────────── */}
      <section className="yd-hanhala" aria-labelledby="yd-hanhala-h">
        <div className="yd-hanhala-head">
          <p className="yd-kicker yd-kicker-light" data-rise>
            <span>(05)</span> Leadership
          </p>
          <h2 id="yd-hanhala-h" className="yd-h2" data-rise>
            The Hanhala <span className="yd-he">הנהלה</span>
          </h2>
        </div>

        <article className="yd-lead">
          <div className="yd-lead-pic" data-speed="0.12">
            <Portrait m={lead} size="lg" />
          </div>
          <div className="yd-lead-text" data-rise>
            <p className="yd-role">{lead.role}</p>
            <h3 className="yd-lead-name">{lead.name}</h3>
            {lead.hebrewName && (
              <p className="yd-he yd-lead-he" lang="he" dir="rtl">
                {lead.hebrewName}
              </p>
            )}
            {lead.bio && <p className="yd-lead-bio">{lead.bio}</p>}
            <Link href="/staff" className="yd-pill-link">
              Full bios <span aria-hidden="true">→</span>
            </Link>
          </div>
        </article>

        <ol className="yd-roster">
          {rest.map((m, i) => (
            <li key={m.slug} className="yd-row">
              <Link href="/staff" className="yd-row-link">
                <Portrait m={m} size="sm" />
                <span className="yd-row-text">
                  <span className="yd-row-num">{String(i + 2).padStart(2, '0')}</span>
                  <span className="yd-row-name">{m.name}</span>
                  <span className="yd-row-role">{m.role}</span>
                </span>
                {m.hebrewName ? (
                  <span className="yd-he yd-row-he" lang="he" dir="rtl">
                    {m.hebrewName}
                  </span>
                ) : (
                  <span className="yd-row-he" />
                )}
                <span className="yd-row-arrow" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 05 · Watch & follow ──────────────────────────────────── */}
      <section className="yd-watch" aria-labelledby="yd-watch-h">
        <p className="yd-kicker" data-rise>
          <span>(06)</span> Watch &amp; follow
        </p>
        <h2 id="yd-watch-h" className="yd-h2 yd-h2-dark" data-rise>
          Follow along
        </h2>
        <div className={`yd-watch-grid ${embed ? 'has-video' : ''}`}>
          {embed && (
            <div className="yd-video" data-rise>
              {playing ? (
                <iframe
                  src={embed + (embed.includes('?') ? '&' : '?') + 'autoplay=1'}
                  title="Latest from Yeshiva Ateret Yaakov"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <button className="yd-video-facade" onClick={() => setPlaying(true)} data-cursor="Play">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://i.ytimg.com/vi/${videoId(embed)}/hqdefault.jpg`} alt="" loading="lazy" />
                  <span className="yd-play">
                    <span aria-hidden="true">▶</span> Play the latest video
                  </span>
                </button>
              )}
            </div>
          )}
          <div className="yd-follow">
            <a href="https://www.youtube.com/@ישיבתעטרתיעקב" target="_blank" rel="noopener noreferrer" className="yd-big-link" data-rise>
              <span className="yd-big-link-k">YouTube</span>
              <span className="yd-big-link-v">Shiurim &amp; content</span>
              <span className="yd-arrow" aria-hidden="true">↗</span>
            </a>
            <a href="https://www.instagram.com/liffs_yeshiva/" target="_blank" rel="noopener noreferrer" className="yd-big-link" data-rise>
              <span className="yd-big-link-k">Instagram</span>
              <span className="yd-big-link-v">Yeshiva life</span>
              <span className="yd-arrow" aria-hidden="true">↗</span>
            </a>
            <a href="https://www.facebook.com/liffsyeshiva/" target="_blank" rel="noopener noreferrer" className="yd-big-link" data-rise>
              <span className="yd-big-link-k">Facebook</span>
              <span className="yd-big-link-v">Updates</span>
              <span className="yd-arrow" aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── 06 · Support ─────────────────────────────────────────── */}
      <section className="yd-support" aria-labelledby="yd-support-h">
        <div className="yd-support-bg yd-grade" data-speed="0.25" aria-hidden="true">
          <Image src={G + 'photo-14.png'} alt="" fill quality={60} sizes="100vw" />
        </div>
        <div className="yd-support-in">
          <p className="yd-kicker yd-kicker-light" data-rise>
            <span>(07)</span> Support
          </p>
          <h2 id="yd-support-h" className="yd-support-h">
            Support the yeshiva
          </h2>
          <p className="yd-support-copy" data-rise>
            Your support empowers bochurim to reach their potential. Every donation is an investment in the future of
            Torah.
          </p>
          <div className="yd-support-row">
            <a ref={giveRef} href={DONATE} target="_blank" rel="noopener noreferrer" className="yd-give-orb" data-cursor="Give">
              <span data-magnet-inner>
                Donate
                <small>CauseMatch ↗</small>
              </span>
            </a>
            <div className="yd-support-links">
              <a href="https://www.charityextra.com/ay" target="_blank" rel="noopener noreferrer" className="yd-give">
                <span className="yd-give-k">UK donors · Gift Aid</span>
                <span className="yd-give-v">CharityExtra</span>
                <span className="yd-arrow" aria-hidden="true">↗</span>
              </a>
              <Link href="/support" className="yd-give">
                <span className="yd-give-k">More ways to give</span>
                <span className="yd-give-v">Support page</span>
                <span className="yd-arrow" aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="yd-footer">
        <div className="yd-footer-top">
          <p>Building Torah. Building Life.</p>
          <p className="yd-placeholder">[Address · phone · email: to add from Dani]</p>
          <p>© {year} Yeshiva Ateret Yaakov</p>
        </div>
        <p className="yd-footer-word" aria-hidden="true">
          <span ref={footFitRef} className="yd-fit">
            Ateret Yaakov
          </span>
        </p>
        <p className="yd-he yd-footer-he" lang="he" dir="rtl">
          ישיבת עטרת יעקב
        </p>
      </footer>
    </div>
  );
}
