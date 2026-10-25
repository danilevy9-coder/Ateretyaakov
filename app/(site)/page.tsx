'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bricolage_Grotesque, Inter_Tight, Frank_Ruhl_Libre } from 'next/font/google';
import { hanhala, type HanhalaMember } from '@/data/hanhala';
import './home.css';

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

// Labels are the ones the current site already uses for these photos.
const spread = [
  { src: G + 'photo-11.png', label: 'Chavrusa', he: 'חברותא', cls: 'yd-s1' },
  { src: G + 'photo-2.png', label: 'Achdus', he: 'אחדות', cls: 'yd-s2' },
  { src: G + 'photo-16.png', label: 'Shiurim', he: 'שיעורים', cls: 'yd-s3' },
  { src: G + 'photo-19.png', label: 'Brotherhood', he: 'אחווה', cls: 'yd-s4' },
  { src: G + 'photo-7.png', label: 'Torah Study', he: 'לימוד תורה', cls: 'yd-s5' },
];

const marqueeWords = [
  ['Torah Study', 'תורה'],
  ['Shiurim', 'שיעורים'],
  ['Achdus', 'אחדות'],
  ['Shabbos', 'שבת'],
  ['Guidance', 'הדרכה'],
  ['Brotherhood', 'אחווה'],
];

function toEmbedUrl(url: string): string {
  if (!url) return '';
  if (url.includes('youtube.com/embed/')) return url;
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return `https://www.youtube.com/embed/${short[1]}?rel=0&modestbranding=1`;
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return `https://www.youtube.com/embed/${watch[1]}?rel=0&modestbranding=1`;
  return '';
}

function videoId(embedUrl: string): string {
  const m = embedUrl.match(/embed\/([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : '';
}

// ── Scroll reveal: adds .is-in when an element enters the viewport ──
function useReveal(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>('.yd [data-reveal]'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.01 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ready]);
}

// ── Fit one line of type to the full width of its container ──
function useFitText() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const line = el.parentElement as HTMLElement;
    const fit = () => {
      el.style.fontSize = '100px';
      const w = el.getBoundingClientRect().width;
      const avail = line.clientWidth;
      if (w > 0 && avail > 0) el.style.fontSize = `${Math.floor((97 * avail) / w)}px`;
    };
    fit();
    // Re-fit once the display face has actually loaded (it swaps in after first paint).
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
  }, []);
  return ref;
}

// ── A small label cursor that follows the mouse over [data-cursor] items ──
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
      const link = (e.target as HTMLElement | null)?.closest('a,button');
      el.classList.toggle('on-link', !!link && !t);
    };
    const tick = () => {
      cx += (x - cx) * 0.25;
      cy += (y - cy) * 0.25;
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
          sizes={size === 'lg' ? '(max-width: 768px) 90vw, 40vw' : '160px'}
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
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);
  const links = [
    { n: '01', href: '/staff', label: 'Hanhala' },
    { n: '02', href: '/gallery', label: 'Gallery' },
    { n: '03', href: '/support', label: 'Support' },
  ];
  return (
    <>
      <header className={`yd-header ${solid ? 'is-solid' : ''}`}>
        <Link href="/" className="yd-mark" aria-label="Yeshiva Ateret Yaakov, home">
          <span className="yd-mark-star" aria-hidden="true">✶</span>
          <span>Ateret Yaakov</span>
          <span className="yd-he yd-mark-he">עטרת יעקב</span>
        </Link>
        <nav className="yd-nav" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              <sup>{l.n}</sup>
              {l.label}
            </Link>
          ))}
        </nav>
        <a className="yd-donate" href="https://causematch.com/yay" target="_blank" rel="noopener noreferrer">
          Donate <span aria-hidden="true">↗</span>
        </a>
        <button
          className="yd-menu-btn"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="yd-menu"
        >
          Menu
        </button>
      </header>
      <div id="yd-menu" className={`yd-menu ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <button className="yd-menu-close" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
          Close
        </button>
        <ul>
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
                <sup>{l.n}</sup>
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <a href="https://causematch.com/yay" target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>
              <sup>04</sup>Donate ↗
            </a>
          </li>
        </ul>
        <p className="yd-he yd-menu-he">ישיבת עטרת יעקב</p>
      </div>
    </>
  );
}

export default function HomePage() {
  const fitRef = useFitText();
  const footFitRef = useFitText();
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useReveal(ready);
  const [embed, setEmbed] = useState('');
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d: { youtubeUrl?: string }) => setEmbed(toEmbedUrl(d.youtubeUrl || '')))
      .catch(() => {});
  }, []);

  const [lead, ...rest] = hanhala;
  const year = new Date().getFullYear();

  return (
    <div className={`yd ${ready ? 'yd-js' : ''} ${display.variable} ${sans.variable} ${hebrew.variable}`}>
      <LabelCursor />
      <Header />

      {/* ── 00 · Hero: the motto, set as the image ───────────────── */}
      <section className="yd-hero" aria-labelledby="yd-motto">
        <p className="yd-kicker yd-hero-kicker">
          <span>(00)</span> Our motto
        </p>
        <h1 id="yd-motto" className="yd-motto">
          <span className="yd-line yd-l1">
            <span className="yd-line-in">
              A yeshiva <span className="yd-nobr">with a</span>
              <span className="yd-pill" data-cursor="Ateret Yaakov">
                <Image src={G + 'photo-3.png'} alt="" fill priority sizes="(max-width: 768px) 50vw, 32vw" />
              </span>
            </span>
          </span>
          <span className="yd-line yd-l2">
            <span ref={fitRef} className="yd-line-in yd-blue yd-fit">
              difference.
            </span>
          </span>
        </h1>
        <div className="yd-hero-foot">
          <p className="yd-hero-copy">
            Yeshiva Ateret Yaakov. Liff&rsquo;s Yeshiva.
          </p>
          <p className="yd-he yd-hero-he" lang="he" dir="rtl">
            ישיבת עטרת יעקב
          </p>
          <a href="#yd-idea" className="yd-scroll">
            Scroll <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      {/* ── Marquee over a full-bleed photo ──────────────────────── */}
      <section className="yd-band" aria-label="Life at the yeshiva">
        <div className="yd-band-img" data-cursor="Beis medrash">
          <Image src={G + 'photo-13.png'} alt="Bochurim in the beis medrash" fill sizes="100vw" />
        </div>
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
      </section>

      {/* ── 01 · The idea ─────────────────────────────────────────── */}
      <section id="yd-idea" className="yd-idea">
        <p className="yd-kicker" data-reveal>
          <span>(01)</span> The idea
        </p>
        <h2 className="yd-statement" data-reveal>
          Every bochur is <em>seen</em>, <em>shaped</em>, and <em>sent forth</em> to lead.
        </h2>
        <div className="yd-idea-grid">
          <figure className="yd-idea-fig" data-reveal data-cursor="Guidance">
            <div className="yd-duo">
              <Image src={G + 'photo-12.png'} alt="A shiur at the yeshiva" fill sizes="(max-width: 768px) 100vw, 45vw" />
            </div>
            <figcaption>
              <span>Fig. 01</span> Guidance
            </figcaption>
          </figure>
          <div className="yd-idea-text" data-reveal>
            <p className="yd-lede">
              From morning seder to late-night chavrusa, every moment is an opportunity to grow in Torah and
              become the best version of yourself.
            </p>
            <blockquote className="yd-quote">
              <p>
                “Every bochur who walks through our doors carries the potential for greatness. Our job is to
                help them discover it.”
              </p>
              <cite>Rabbi Yehoshua Liff</cite>
            </blockquote>
          </div>
        </div>
      </section>

      {/* ── 02 · Life: an asymmetric spread ──────────────────────── */}
      <section className="yd-life" aria-labelledby="yd-life-h">
        <div className="yd-life-head">
          <p className="yd-kicker" data-reveal>
            <span>(02)</span> Life here
          </p>
          <h2 id="yd-life-h" className="yd-h2" data-reveal>
            Inside the <span className="yd-he yd-h2-he">בית מדרש</span>
          </h2>
          <Link href="/gallery" className="yd-textlink" data-reveal>
            Full gallery <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="yd-spread">
          {spread.map((p, i) => (
            <figure key={p.src} className={`yd-spread-item ${p.cls}`} data-reveal data-cursor={p.label}>
              <div className="yd-duo">
                <Image src={p.src} alt={p.label} fill sizes="(max-width: 768px) 100vw, 50vw" />
              </div>
              <figcaption>
                <span>02.{i + 1}</span> {p.label} <i className="yd-he">{p.he}</i>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── 03 · Hanhala ─────────────────────────────────────────── */}
      <section className="yd-hanhala" aria-labelledby="yd-hanhala-h">
        <div className="yd-hanhala-head">
          <p className="yd-kicker" data-reveal>
            <span>(03)</span> Leadership
          </p>
          <h2 id="yd-hanhala-h" className="yd-h2 yd-h2-xl" data-reveal>
            The Hanhala <span className="yd-he yd-h2-he">הנהלה</span>
          </h2>
        </div>

        <article className="yd-lead" data-reveal>
          <Portrait m={lead} size="lg" />
          <div className="yd-lead-text">
            <p className="yd-num">01</p>
            <p className="yd-role">{lead.role}</p>
            <h3 className="yd-lead-name">{lead.name}</h3>
            {lead.hebrewName && (
              <p className="yd-he yd-lead-he" lang="he" dir="rtl">
                {lead.hebrewName}
              </p>
            )}
            {lead.bio && <p className="yd-lead-bio">{lead.bio}</p>}
            <Link href="/staff" className="yd-textlink">
              Full bios <span aria-hidden="true">→</span>
            </Link>
          </div>
        </article>

        <ol className="yd-roster">
          {rest.map((m, i) => (
            <li key={m.slug} className="yd-row" data-reveal>
              <Link href="/staff" className="yd-row-link">
                <span className="yd-num">{String(i + 2).padStart(2, '0')}</span>
                <span className="yd-row-name">{m.name}</span>
                <span className="yd-row-role">{m.role}</span>
                {m.hebrewName ? (
                  <span className="yd-he yd-row-he" lang="he" dir="rtl">
                    {m.hebrewName}
                  </span>
                ) : (
                  <span className="yd-row-he" />
                )}
                <Portrait m={m} size="sm" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 04 · Watch & follow ──────────────────────────────────── */}
      <section className="yd-watch" aria-labelledby="yd-watch-h">
        <p className="yd-kicker" data-reveal>
          <span>(04)</span> Watch &amp; follow
        </p>
        <div className={`yd-watch-grid ${embed ? 'has-video' : ''}`}>
          {embed && (
            <div className="yd-video" data-reveal>
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
            <h2 id="yd-watch-h" className="yd-visually-hidden">
              Watch and follow
            </h2>
            <a href="https://www.youtube.com/@ישיבתעטרתיעקב" target="_blank" rel="noopener noreferrer" className="yd-big-link" data-reveal>
              <span className="yd-big-link-k">YouTube</span>
              <span className="yd-big-link-v">Shiurim &amp; content</span>
              <span className="yd-big-link-h yd-he">@ישיבתעטרתיעקב</span>
              <span className="yd-arrow" aria-hidden="true">↗</span>
            </a>
            <a href="https://www.instagram.com/liffs_yeshiva/" target="_blank" rel="noopener noreferrer" className="yd-big-link" data-reveal>
              <span className="yd-big-link-k">Instagram</span>
              <span className="yd-big-link-v">Yeshiva life</span>
              <span className="yd-big-link-h">@liffs_yeshiva</span>
              <span className="yd-arrow" aria-hidden="true">↗</span>
            </a>
            <a href="https://www.facebook.com/liffsyeshiva/" target="_blank" rel="noopener noreferrer" className="yd-big-link" data-reveal>
              <span className="yd-big-link-k">Facebook</span>
              <span className="yd-big-link-v">Updates</span>
              <span className="yd-big-link-h">liffsyeshiva</span>
              <span className="yd-arrow" aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── 05 · Support ─────────────────────────────────────────── */}
      <section className="yd-support" aria-labelledby="yd-support-h">
        <p className="yd-kicker yd-kicker-light" data-reveal>
          <span>(05)</span> Support
        </p>
        <h2 id="yd-support-h" className="yd-support-h" data-reveal>
          Support the yeshiva
        </h2>
        <p className="yd-support-copy" data-reveal>
          Your support empowers bochurim to reach their potential. Every donation is an investment in the future
          of Torah.
        </p>
        <div className="yd-support-links">
          <a href="https://causematch.com/yay" target="_blank" rel="noopener noreferrer" className="yd-give" data-reveal>
            <span className="yd-give-k">Donate</span>
            <span className="yd-give-v">CauseMatch</span>
            <span className="yd-arrow" aria-hidden="true">↗</span>
          </a>
          <a href="https://www.charityextra.com/ay" target="_blank" rel="noopener noreferrer" className="yd-give" data-reveal>
            <span className="yd-give-k">UK donors · Gift Aid</span>
            <span className="yd-give-v">CharityExtra</span>
            <span className="yd-arrow" aria-hidden="true">↗</span>
          </a>
          <Link href="/support" className="yd-give yd-give-sm" data-reveal>
            <span className="yd-give-k">More ways to give</span>
            <span className="yd-give-v">Support page</span>
            <span className="yd-arrow" aria-hidden="true">→</span>
          </Link>
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
