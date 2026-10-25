'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Bricolage_Grotesque, Inter_Tight, Frank_Ruhl_Libre, Heebo, Karantina } from 'next/font/google';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { HEBREW_ENABLED, useLang } from '@/lib/yd/lang';
import type { HanhalaMember } from '@/data/hanhala';
import './yd.css';

gsap.registerPlugin(ScrollTrigger);

// ── Type. English: a condensed display face + a clean sans (+ a Hebrew serif for accents).
//    Hebrew: Karantina (bold condensed display) + Heebo (body). ──
const display = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz', 'wdth'], variable: '--yd-display', display: 'swap' });
const sans = Inter_Tight({ subsets: ['latin'], variable: '--yd-sans', display: 'swap' });
const hebrew = Frank_Ruhl_Libre({ subsets: ['hebrew'], weight: ['400', '700'], variable: '--yd-hebrew', display: 'swap' });
const heSans = Heebo({ subsets: ['hebrew', 'latin'], variable: '--yd-he-sans', display: 'swap' });
const heDisplay = Karantina({ subsets: ['hebrew', 'latin'], weight: ['400', '700'], variable: '--yd-he-display', display: 'swap' });
const fontVars = [display.variable, sans.variable, hebrew.variable, heSans.variable, heDisplay.variable].join(' ');

export const DONATE = 'https://causematch.com/yay';
export const CHARITY_EXTRA = 'https://www.charityextra.com/ay';
export const EMAIL = 'info@ateretyaakov.com';
export const SOCIAL = {
  youtube: 'https://www.youtube.com/@ישיבתעטרתיעקב',
  instagram: 'https://www.instagram.com/liffs_yeshiva/',
  facebook: 'https://www.facebook.com/liffsyeshiva/',
};
export const G = '/images/gallery/';

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** true once mounted, unless the visitor asked for reduced motion */
export function useMotion() {
  const [m, setM] = useState(false);
  useEffect(() => setM(!prefersReducedMotion()), []);
  return m;
}

export function cssVars(v: Record<string, string | number>) {
  return v as CSSProperties;
}

// ── Fit one line of type to the full width of its container ──
export function useFitText(ratio = 0.97) {
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
export function useMagnetic<T extends HTMLElement>(strength = 0.35) {
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

/**
 * Scroll motion shared by every page (GSAP ScrollTrigger; transforms and opacity only):
 *  [data-rise]           fades and rises in once
 *  [data-speed="0.2"]    parallax depth
 *  .yd-unmask            image frame opens up, photo settles inside
 *  .yd-river-col[data-drift] / .yd-river-item / .yd-river-big   the drifting photo columns
 *  .yd-pagehero          inner-page hero drifts and darkens as you leave it
 */
export function useSharedMotion(rootRef: React.RefObject<HTMLElement>, motion: boolean, deps: unknown[] = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (!motion || !root) return;
    ScrollTrigger.config({ ignoreMobileResize: true });
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('[data-rise]').forEach((el) => {
        gsap.from(el, { y: 40, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
      });
      gsap.utils.toArray<HTMLElement>('[data-speed]').forEach((el) => {
        const s = parseFloat(el.dataset.speed || '0');
        gsap.fromTo(el, { yPercent: -s * 50 }, { yPercent: s * 50, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
      gsap.utils.toArray<HTMLElement>('.yd-unmask').forEach((el) => {
        const img = el.querySelector('img');
        gsap.fromTo(el, { clipPath: 'inset(14% 12% 14% 12% round 28px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 35%', scrub: true } });
        if (img) gsap.fromTo(img, { scale: 1.3 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
      gsap.utils.toArray<HTMLElement>('.yd-river').forEach((river) => {
        river.querySelectorAll<HTMLElement>('.yd-river-col').forEach((col) => {
          const s = parseFloat(col.dataset.drift || '0');
          gsap.fromTo(col, { y: () => s * window.innerHeight }, { y: () => -s * window.innerHeight, ease: 'none', scrollTrigger: { trigger: river, start: 'top bottom', end: 'bottom top', scrub: 0.3, invalidateOnRefresh: true } });
        });
        const big = river.querySelector('.yd-river-big');
        if (big) gsap.fromTo(big, { xPercent: 8 }, { xPercent: -30, ease: 'none', scrollTrigger: { trigger: river, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
      gsap.utils.toArray<HTMLElement>('.yd-river-item').forEach((el) => {
        const img = el.querySelector('img');
        gsap.fromTo(el, { scale: 0.78, opacity: 0.2, rotate: () => (Math.random() - 0.5) * 6 }, { scale: 1, opacity: 1, rotate: 0, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 100%', end: 'top 55%', scrub: 0.3 } });
        if (img) gsap.fromTo(img, { scale: 1.4, yPercent: -6 }, { scale: 1.05, yPercent: 6, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
      gsap.utils.toArray<HTMLElement>('.yd-pagehero').forEach((hero) => {
        gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })
          .to(hero.querySelector('.yd-pagehero-media'), { yPercent: 18, scale: 1.08, ease: 'none' }, 0)
          .to(hero.querySelector('.yd-pagehero-copy'), { yPercent: -14, ease: 'none' }, 0);
      });
    }, root);
    const timers = [400, 1500, 3500].map((t) => window.setTimeout(() => ScrollTrigger.refresh(), t));
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion, ...deps]);
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
export function Portrait({ m, size }: { m: HanhalaMember; size: 'lg' | 'sm' }) {
  const { t } = useLang();
  return (
    <div className={`yd-portrait yd-portrait-${size}`}>
      {m.photo ? (
        <Image src={m.photo} alt={m.name} fill sizes={size === 'lg' ? '(max-width: 900px) 90vw, 40vw' : '120px'} className="yd-portrait-img" />
      ) : (
        <div className="yd-portrait-ph" role="img" aria-label={`${m.name}, ${t.hanhala.photoToCome}`}>
          <span className="yd-ph-name" aria-hidden="true">{m.surname}</span>
          <span className="yd-ph-tag">{t.hanhala.photoToCome}</span>
        </div>
      )}
    </div>
  );
}

/** Name in the current language; Hebrew mode shows a clear placeholder when the Hebrew name is unknown. */
export function useStaffName() {
  const { lang } = useLang();
  return (m: HanhalaMember) => {
    if (lang === 'he') return m.hebrewName || m.name;
    return m.name;
  };
}

function LangToggle({ className = '' }: { className?: string }) {
  const { lang, t, setLang } = useLang();
  if (!HEBREW_ENABLED) return null;
  return (
    <button
      type="button"
      className={`yd-lang ${className}`}
      onClick={() => setLang(lang === 'he' ? 'en' : 'he')}
      aria-label={t.nav.switchLabel}
      lang={lang === 'he' ? 'en' : 'he'}
    >
      <span className={lang === 'en' ? 'is-on' : ''}>EN</span>
      <i aria-hidden="true">|</i>
      <span className={lang === 'he' ? 'is-on' : ''}>עב</span>
    </button>
  );
}

function Header() {
  const { t } = useLang();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const donateRef = useMagnetic<HTMLAnchorElement>(0.3);
  useEffect(() => setOpen(false), [path]);
  // Slide the header away while scrolling down (so it never sits on top of a heading), back on scroll up.
  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      const d = y - last;
      if (y < 120) setHidden(false);
      else if (d > 6) setHidden(true);
      else if (d < -6) setHidden(false);
      if (Math.abs(d) > 6) last = y;
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const hide = hidden && !open;
  useEffect(() => {
    document.documentElement.classList.toggle('yd-locked', open);
    return () => document.documentElement.classList.remove('yd-locked');
  }, [open]);
  const links = [
    { n: '01', href: '/staff', label: t.nav.hanhala, alt: 'הנהלה' },
    { n: '02', href: '/gallery', label: t.nav.gallery, alt: 'גלריה' },
    { n: '03', href: '/support', label: t.nav.support, alt: 'תמיכה' },
  ];
  return (
    <>
      <header className={`yd-header ${hide ? 'is-hidden' : ''}`}>
        <Link href="/" className="yd-mark" aria-label={t.meta.fullName}>
          <span className="yd-mark-star" aria-hidden="true">✶</span>
          <span>{t.meta.name}</span>
        </Link>
        <nav className="yd-nav" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? 'is-here' : ''}>
              <sup>{l.n}</sup>
              {l.label}
            </Link>
          ))}
        </nav>
        <LangToggle />
        <button
          className={`yd-menu-btn ${open ? 'is-open' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="yd-menu"
          aria-label={open ? t.nav.close : t.nav.menu}
        >
          <span className="yd-burger" aria-hidden="true">
            <i />
            <i />
          </span>
        </button>
      </header>
      <div className={`yd-donate-wrap ${hide ? 'is-hidden' : ''}`}>
        <a ref={donateRef} className="yd-donate" href={DONATE} target="_blank" rel="noopener noreferrer" data-cursor={t.nav.donate}>
          <span data-magnet-inner>
            {t.nav.donate} <span aria-hidden="true">↗</span>
          </span>
        </a>
      </div>
      <div id="yd-menu" className={`yd-menu ${open ? 'is-open' : ''}`} aria-hidden={!open} data-lenis-prevent>
        <ul>
          {[{ n: '00', href: '/', label: t.nav.home, alt: '' }, ...links].map((l, i) => (
            <li key={l.href} style={cssVars({ '--i': i })}>
              <Link href={l.href} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
                <sup>{l.n}</sup>
                <span className="yd-menu-word">{l.label}</span>
              </Link>
            </li>
          ))}
          <li style={cssVars({ '--i': 4 })}>
            <a href={DONATE} target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>
              <sup>04</sup>
              <span className="yd-menu-word yd-menu-give">{t.nav.donate} ↗</span>
            </a>
          </li>
        </ul>
        <div className="yd-menu-foot">
          <LangToggle className="yd-lang-lg" />
          <p>
            <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>Instagram</a>
            {' · '}
            <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>YouTube</a>
            {' · '}
            <a href={SOCIAL.facebook} target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>Facebook</a>
          </p>
        </div>
      </div>
    </>
  );
}

function Footer() {
  const { t, lang } = useLang();
  const fitRef = useFitText();
  const year = new Date().getFullYear();
  return (
    <footer className="yd-footer">
      <div className="yd-footer-top">
        <p>{t.footer.tag}</p>
        <p>
          <a href={`mailto:${EMAIL}`} className="yd-footer-mail">{EMAIL}</a>
          <span className="yd-placeholder"> {t.footer.contactPlaceholder}</span>
        </p>
        <p className="yd-footer-links">
          <Link href="/staff">{t.nav.hanhala}</Link>
          <Link href="/gallery">{t.nav.gallery}</Link>
          <Link href="/support">{t.nav.support}</Link>
          <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer">YouTube</a>
        </p>
        <p>© {year} {t.footer.rights}</p>
      </div>
      <p className="yd-footer-word" aria-hidden="true">
        <span ref={fitRef} className="yd-fit">{t.meta.name}</span>
      </p>
      <p className="yd-footer-alt" lang={lang === 'he' ? 'en' : 'he'}>
        {lang === 'he' ? 'Yeshiva Ateret Yaakov' : 'ישיבת עטרת יעקב'}
      </p>
    </footer>
  );
}

/** Inner-page opening: one real photo drifting behind a huge fitted title. */
export function PageHero({ kicker, title, pre, accent, intro, src, pos = '50% 45%' }: { kicker: string; title: string; pre?: string; accent?: string; intro?: string; src: string; pos?: string }) {
  const fitRef = useFitText(0.98);
  return (
    <section className="yd-pagehero" aria-label={title}>
      <div className="yd-pagehero-media yd-grade" aria-hidden="true">
        <div className="yd-pagehero-kb">
          <Image src={src} alt="" fill priority quality={62} sizes="(orientation: portrait) 165vh, 100vw" style={{ objectPosition: pos }} />
        </div>
        <div className="yd-hero-grain" />
      </div>
      <div className="yd-pagehero-copy">
        <p className="yd-kicker yd-kicker-light yd-fadein">{kicker}{accent ? <i className="yd-accent">{accent}</i> : null}</p>
        {pre ? <p className="yd-pagehero-pre"><span className="yd-rise" style={cssVars({ '--d': '0.1s' })}>{pre}</span></p> : null}
        <h1 className="yd-pagehero-h">
          <span ref={fitRef} className="yd-fit">
            {Array.from(title).map((c, i) => (
              <span key={i} className="yd-char" style={cssVars({ '--i': i })}>
                {c === ' ' ? '\u00a0' : c}
              </span>
            ))}
          </span>
        </h1>
        {intro ? <p className="yd-pagehero-intro yd-fadein">{intro}</p> : null}
      </div>
    </section>
  );
}

function YdShell({ children }: { children: ReactNode }) {
  const { lang, rtl } = useLang();
  const motion = useMotion();
  return (
    <div className={`yd ${motion ? 'yd-motion' : ''} ${fontVars}`} dir={rtl ? 'rtl' : 'ltr'} lang={lang}>
      <LabelCursor />
      <Header />
      {/* remount on language change so every split word, fitted line and scroll trigger is rebuilt */}
      <main key={lang}>{children}</main>
      <Footer key={`f-${lang}`} />
    </div>
  );
}

export default YdShell;
