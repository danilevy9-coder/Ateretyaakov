'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';

// ── YouTube URL → embed URL ────────────────────────────────────
function toEmbedUrl(url: string): string {
  if (!url) return '';
  if (url.includes('youtube.com/embed/')) return url;
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return `https://www.youtube.com/embed/${short[1]}?rel=0&modestbranding=1`;
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return `https://www.youtube.com/embed/${watch[1]}?rel=0&modestbranding=1`;
  return url;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ── Content ───────────────────────────────────────────────────
const lifePhotos = [
  { src: '/images/gallery/beis-medrash-1.jpg', alt: 'Beis Medrash learning', label: 'Torah Study' },
  { src: '/images/gallery/shiur-1.jpg', alt: 'Shiur in session', label: 'Shiurim' },
  { src: '/images/gallery/bochurim-1.jpg', alt: 'Bochurim together', label: 'Achdus' },
  { src: '/images/gallery/shabbos-1.jpg', alt: 'Shabbos at Yeshiva', label: 'Shabbos' },
  { src: '/images/gallery/rabbi-liff-teaching.jpg', alt: 'Rabbi Liff teaching', label: 'Guidance' },
  { src: '/images/gallery/bochurim-2.jpg', alt: 'Growth and brotherhood', label: 'Brotherhood' },
];

const stats = [
  { label: 'Bochurim', value: 40, suffix: '+' },
  { label: 'Years Strong', value: 10, suffix: '+' },
  { label: 'Alumni', value: 200, suffix: '+' },
  { label: 'Daily Chaburos', value: 8, suffix: '' },
];

const hanhala = [
  {
    name: 'Rabbi Yehoshua Liff',
    title: 'Rosh Yeshiva',
    bio: 'Graduate of Yeshivat Ner Israel of Baltimore, founder of Yeshivat Ner Yaacov of Jerusalem. A visionary leader who has dedicated his life to building the next generation of Torah leaders.',
  },
  {
    name: 'Rabbi Dov Ber Liff',
    title: 'Rosh Yeshiva',
    bio: 'Graduate of Yeshivat Givat Shaul. His genuine warmth and individual care for every bochur sets the tone for the entire yeshiva. An exceptional educator with decades of experience.',
  },
  {
    name: 'Rabbi Larry Shain',
    title: 'Mashgiach & Administrator',
    bio: 'Co-founder and CEO of Ohr Somayach South Africa for 25 years. Brings deep professional wisdom and a warm heart to guiding each bochur on their personal journey.',
  },
];

const CAUSEMATCH = 'https://causematch.com/yay';
const CHARITYEXTRA = 'https://www.charityextra.com/ay';
const INSTAGRAM = 'https://www.instagram.com/liffs_yeshiva/';
const YOUTUBE = 'https://www.youtube.com/@ישיבתעטרתיעקב';

// ── Small building blocks ─────────────────────────────────────
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className={`h-px w-8 ${light ? 'bg-gold-500' : 'bg-gold'}`} />
      <span
        className={`text-[11px] font-semibold tracking-[0.28em] uppercase ${
          light ? 'text-gold-500' : 'text-gold'
        }`}
      >
        {children}
      </span>
    </div>
  );
}

function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const duration = 1600;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      if (ref.current) ref.current.textContent = `${Math.round(eased * to)}${suffix}`;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, suffix]);
  return (
    <span ref={ref}>
      {to}
      {suffix}
    </span>
  );
}

function Initials({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter((w) => w !== 'Rabbi')
    .map((w) => w[0])
    .join('')
    .slice(0, 2);
  return (
    <div className="w-16 h-16 rounded-full border border-gold/40 flex items-center justify-center bg-gradient-to-br from-gold/15 to-transparent">
      <span className="font-serif text-xl text-gold">{initials}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════════════
export default function HomePage() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroImageY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const heroTextY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroFade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const [youtubeEmbedUrl, setYoutubeEmbedUrl] = useState<string | null>(null);

  // Saved YouTube link from /admin → Video Settings
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: { youtubeUrl?: string }) => {
        if (data.youtubeUrl) setYoutubeEmbedUrl(toEmbedUrl(data.youtubeUrl));
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* ════════════════════════════════════════════════════════
          HERO — full-bleed photograph
      ════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative h-[100svh] min-h-[640px] w-full overflow-hidden bg-[#070b12]"
      >
        <motion.div style={{ y: heroImageY }} className="absolute inset-0 -top-[6%] h-[112%]">
          <motion.div
            initial={{ scale: 1.12 }}
            animate={{ scale: 1 }}
            transition={{ duration: 2.4, ease: EASE }}
            className="absolute inset-0"
          >
            <Image
              src="/images/hero/beis-medrash.png"
              alt="Bochurim learning in the Beis Medrash of Yeshiva Ateret Yaakov"
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
          </motion.div>
        </motion.div>
        {/* Overlays for legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#070b12]/80 via-[#070b12]/45 to-[#070b12]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070b12]/85 via-[#070b12]/30 to-transparent" />

        <motion.div
          style={{ y: heroTextY, opacity: heroFade }}
          className="relative z-10 h-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col justify-end pb-36 md:pb-40"
        >
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
            className="font-hebrew text-gold/90 text-xl md:text-2xl mb-6"
            dir="rtl"
          >
            יְשִׁיבַת עֲטֶרֶת יַעֲקֹב
          </motion.p>
          <h1 className="font-serif text-white font-semibold leading-[0.95] tracking-tight text-[3.25rem] sm:text-7xl lg:text-[6.5rem] max-w-4xl">
            {['Building Torah.', 'Building Life.'].map((line, i) => (
              <span key={line} className="block overflow-hidden pb-2">
                <motion.span
                  className={`block ${i === 1 ? 'italic text-gold-100' : ''}`}
                  initial={{ y: '105%' }}
                  animate={{ y: '0%' }}
                  transition={{ duration: 1.1, delay: 0.45 + i * 0.15, ease: EASE }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.9, ease: EASE }}
            className="mt-7 max-w-xl text-white/75 text-lg md:text-xl leading-relaxed font-light"
          >
            A yeshiva where every bochur is seen, shaped, and sent forth to lead — under the
            guidance of Rabbi Yehoshua Liff and Rabbi Dov Ber Liff.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.05, ease: EASE }}
            className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4"
          >
            <Link
              href="/support"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gold text-[#0b0b0d] font-semibold tracking-wide hover:bg-gold-200 transition-colors"
            >
              Support the Yeshiva
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/staff"
              className="inline-flex items-center justify-center px-8 py-4 rounded-full border border-white/25 text-white font-medium tracking-wide backdrop-blur-sm hover:bg-white/10 hover:border-white/40 transition-colors"
            >
              Meet the Hanhala
            </Link>
          </motion.div>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.3, ease: EASE }}
          className="absolute bottom-0 left-0 right-0 z-10 border-t border-white/10 bg-[#070b12]/60 backdrop-blur-md"
        >
          <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-4 divide-x divide-white/10">
            {stats.map((s) => (
              <div key={s.label} className="py-5 md:py-6 px-2 md:px-6 text-center md:text-left">
                <div className="font-serif text-2xl md:text-4xl text-white">
                  <Counter to={s.value} suffix={s.suffix} />
                </div>
                <div className="mt-1 text-[10px] md:text-xs uppercase tracking-[0.18em] text-white/50">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════════════════
          MISSION — light section
      ════════════════════════════════════════════════════════ */}
      <section className="bg-cream text-[#14161c] py-24 md:py-36 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <Reveal className="lg:col-span-7">
            <Eyebrow light>Our Mission</Eyebrow>
            <blockquote className="font-serif text-3xl md:text-5xl leading-[1.15] tracking-tight">
              “Every bochur who walks through our doors carries the potential for{' '}
              <em className="text-gold-500">greatness</em> — our job is to help them discover
              it.”
            </blockquote>
            <p className="mt-8 text-sm tracking-wide text-[#14161c]/60">
              — Rabbi Yehoshua Liff, Rosh Yeshiva
            </p>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium">
              <Link href="/staff" className="hover-underline text-[#14161c]">
                Meet the Hanhala →
              </Link>
              <Link href="/gallery" className="hover-underline text-[#14161c]">
                Visit the gallery →
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.15} className="lg:col-span-5">
            <div className="relative aspect-[4/5] rounded-[28px] overflow-hidden shadow-[0_30px_80px_-30px_rgba(20,22,28,0.45)]">
              <Image
                src="/images/gallery/rabbi-liff-teaching.jpg"
                alt="Rabbi Liff teaching"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          LIFE AT THE YESHIVA — photo grid
      ════════════════════════════════════════════════════════ */}
      <section className="bg-[#efe8dc] text-[#14161c] py-24 md:py-32 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <Reveal className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 md:mb-16">
            <div>
              <Eyebrow light>Life at the Yeshiva</Eyebrow>
              <h2 className="font-serif text-4xl md:text-6xl tracking-tight leading-[1.05] max-w-2xl">
                Every moment, a chance to grow.
              </h2>
            </div>
            <p className="max-w-md text-[#14161c]/65 leading-relaxed">
              From morning seder to late-night chavrusa — every moment is an opportunity to grow in
              Torah and become the best version of yourself.
            </p>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[180px] md:auto-rows-[240px] gap-3 md:gap-4">
            {lifePhotos.map((p, i) => {
              const span =
                i === 0
                  ? 'col-span-2 row-span-2'
                  : i === 3
                  ? 'col-span-2 md:col-span-2'
                  : 'col-span-1';
              return (
                <Reveal key={p.src} delay={(i % 3) * 0.08} className={`${span} h-full`}>
                  <div className="group relative h-full w-full overflow-hidden rounded-2xl md:rounded-3xl bg-[#d9d0c1]">
                    <Image
                      src={p.src}
                      alt={p.alt}
                      fill
                      sizes={i === 0 ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 768px) 25vw, 50vw'}
                      className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
                    <span className="absolute left-4 bottom-4 text-white text-[11px] md:text-xs font-semibold uppercase tracking-[0.2em]">
                      {p.label}
                    </span>
                  </div>
                </Reveal>
              );
            })}
          </div>

          <Reveal className="mt-12 flex justify-center">
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-[#14161c]/20 text-[#14161c] font-medium hover:bg-[#14161c] hover:text-cream transition-colors"
            >
              See the full gallery →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          HANHALA PREVIEW — dark section
      ════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#0b111b] py-24 md:py-36 px-6 lg:px-12 overflow-hidden">
        <div className="pointer-events-none absolute -top-40 right-0 w-[640px] h-[640px] rounded-full bg-gold/[0.06] blur-3xl" />
        <div className="relative max-w-7xl mx-auto">
          <Reveal className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
            <div>
              <Eyebrow>Leadership</Eyebrow>
              <h2 className="font-serif text-4xl md:text-6xl text-white tracking-tight leading-[1.05]">
                Meet the Hanhala
              </h2>
            </div>
            <Link href="/staff" className="text-gold font-medium hover-underline self-start md:self-auto">
              View full team →
            </Link>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-px bg-white/10 rounded-3xl overflow-hidden border border-white/10">
            {hanhala.map((r, i) => (
              <Reveal key={r.name} delay={i * 0.1} className="h-full">
                <Link
                  href="/staff"
                  className="group flex flex-col h-full bg-[#0b111b] p-8 md:p-10 hover:bg-[#101827] transition-colors"
                >
                  <Initials name={r.name} />
                  <div className="mt-8 text-gold text-[11px] font-semibold tracking-[0.24em] uppercase">
                    {r.title}
                  </div>
                  <h3 className="mt-2 font-serif text-2xl md:text-[1.7rem] text-white group-hover:text-gold-100 transition-colors">
                    {r.name}
                  </h3>
                  <p className="mt-4 text-white/55 text-[15px] leading-relaxed">{r.bio}</p>
                  <span className="mt-auto pt-8 text-sm text-white/40 group-hover:text-gold transition-colors">
                    Read bio →
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          WATCH & FOLLOW
      ════════════════════════════════════════════════════════ */}
      <section className="bg-[#0b111b] pb-24 md:pb-36 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-6">
          {/* YouTube */}
          <Reveal className="lg:col-span-8">
            <div className="h-full rounded-3xl overflow-hidden border border-white/10 bg-white/[0.03]">
              <div className="aspect-video bg-black">
                {youtubeEmbedUrl ? (
                  <iframe
                    src={youtubeEmbedUrl}
                    title="Yeshiva Ateret Yaakov YouTube"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                ) : (
                  <a
                    href={YOUTUBE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block w-full h-full"
                  >
                    <Image
                      src="/images/gallery/shiur-1.jpg"
                      alt="Torah shiurim on YouTube"
                      fill
                      sizes="(min-width: 1024px) 66vw, 100vw"
                      className="object-cover opacity-60 group-hover:opacity-75 transition-opacity"
                    />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-20 h-20 rounded-full bg-white/90 text-[#0b111b] flex items-center justify-center text-2xl pl-1 group-hover:scale-105 transition-transform">
                        ▶
                      </span>
                    </span>
                  </a>
                )}
              </div>
              <div className="flex items-center justify-between gap-4 p-6 md:p-8">
                <div>
                  <p className="text-white font-serif text-xl">Torah Shiurim &amp; Content</p>
                  <p className="text-white/45 text-sm mt-1">@ישיבתעטרתיעקב on YouTube</p>
                </div>
                <a
                  href={YOUTUBE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 px-5 py-2.5 rounded-full border border-white/20 text-white text-sm hover:bg-white hover:text-[#0b111b] transition-colors"
                >
                  Subscribe
                </a>
              </div>
            </div>
          </Reveal>

          {/* Instagram */}
          <Reveal delay={0.1} className="lg:col-span-4">
            <div className="h-full flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-serif text-xl">@liffs_yeshiva</p>
                  <p className="text-white/45 text-sm mt-1">Daily Torah inspiration &amp; yeshiva life</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2 flex-1">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="relative aspect-square rounded-xl overflow-hidden bg-white/5">
                    <Image
                      src={`/images/gallery/photo-${n}.png`}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 10vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
              <a
                href={INSTAGRAM}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex justify-center px-5 py-3 rounded-full bg-white text-[#0b111b] text-sm font-semibold hover:bg-gold transition-colors"
              >
                Follow on Instagram
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          SUPPORT — light section
      ════════════════════════════════════════════════════════ */}
      <section className="bg-cream text-[#14161c] py-24 md:py-36 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <Reveal className="max-w-3xl mb-14">
            <Eyebrow light>Partner With Us</Eyebrow>
            <h2 className="font-serif text-4xl md:text-6xl tracking-tight leading-[1.05]">
              Your support builds the next generation.
            </h2>
            <p className="mt-6 text-lg text-[#14161c]/65 leading-relaxed">
              Your support empowers bochurim to reach their potential. Every donation is an
              investment in the future of Torah, with matching opportunities available.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-6">
            {/* CauseMatch */}
            <Reveal className="h-full">
              <div className="h-full flex flex-col rounded-3xl bg-[#0b111b] text-white p-8 md:p-10 shadow-[0_30px_80px_-40px_rgba(11,17,27,0.6)]">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-60 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                  </span>
                  Live Campaign
                </div>
                <h3 className="mt-5 font-serif text-3xl md:text-4xl">CauseMatch Campaign</h3>
                <p className="mt-3 text-white/60 leading-relaxed">
                  Support our bochurim&apos;s Torah journey. Every dollar matched — double the impact.
                </p>
                <div className="mt-10">
                  <div className="flex justify-between text-sm text-white/50 mb-3">
                    <span>Campaign Progress</span>
                    <span className="text-gold font-semibold">
                      <Counter to={73} suffix="%" />
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: '73%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.6, ease: EASE }}
                      className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-100"
                    />
                  </div>
                </div>
                <a
                  href={CAUSEMATCH}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-10 md:mt-auto md:pt-10"
                >
                  <span className="flex justify-center px-6 py-4 rounded-full bg-gold text-[#0b0b0d] font-semibold hover:bg-gold-200 transition-colors">
                    Donate on CauseMatch
                  </span>
                </a>
              </div>
            </Reveal>

            {/* CharityExtra */}
            <Reveal delay={0.1} className="h-full">
              <div className="h-full flex flex-col rounded-3xl bg-white border border-[#14161c]/10 p-8 md:p-10">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-500">
                  UK Donors — Tax Relief
                </div>
                <h3 className="mt-5 font-serif text-3xl md:text-4xl">CharityExtra</h3>
                <p className="mt-3 text-[#14161c]/65 leading-relaxed">
                  UK-based? Donate through CharityExtra and qualify for Gift Aid — maximise your
                  impact at no extra cost.
                </p>
                <a
                  href={CHARITYEXTRA}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-10 md:mt-auto md:pt-10"
                >
                  <span className="flex justify-center px-6 py-4 rounded-full border border-[#14161c]/20 font-semibold hover:bg-[#14161c] hover:text-cream transition-colors">
                    Donate via CharityExtra →
                  </span>
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          FINAL CTA — photo
      ════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden py-32 md:py-44 px-6 lg:px-12">
        <Image
          src="/images/hero/bochurim.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[#070b12]/80" />
        <div className="relative max-w-4xl mx-auto text-center">
          <Reveal>
            <h2 className="font-serif text-5xl md:text-7xl text-white tracking-tight leading-[1.02]">
              Be part of the <em className="text-gold-100">story</em>.
            </h2>
            <p className="mt-6 text-white/70 text-lg max-w-xl mx-auto leading-relaxed">
              Ready to be part of something extraordinary? Join the families and friends who make
              Ateret Yaakov possible.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <a
                href={CAUSEMATCH}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-9 py-4 rounded-full bg-gold text-[#0b0b0d] font-semibold hover:bg-gold-200 transition-colors"
              >
                Donate on CauseMatch
              </a>
              <a
                href={CHARITYEXTRA}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-9 py-4 rounded-full border border-white/30 text-white font-medium hover:bg-white/10 transition-colors"
              >
                CharityExtra (UK)
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
