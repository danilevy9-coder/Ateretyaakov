'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useInView, useMotionValue, useTransform } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getImageSrc } from '@/lib/imageUrl';

gsap.registerPlugin(ScrollTrigger);

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

// Lazy-load the 3D canvas (SSR-safe)
const HeroCanvas = dynamic(() => import('@/components/HeroCanvas'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-obsidian" />,
});

// ── Gallery images for horizontal scroll ──────────────────────
const scrollImages = [
  { src: '/images/gallery/beis-medrash-1.jpg', alt: 'Beis Medrash learning', label: 'Torah Study' },
  { src: '/images/gallery/shiur-1.jpg', alt: 'Shiur in session', label: 'Shiurim' },
  { src: '/images/gallery/bochurim-1.jpg', alt: 'Bochurim together', label: 'Achdus' },
  { src: '/images/gallery/shabbos-1.jpg', alt: 'Shabbos at Yeshiva', label: 'Shabbos' },
  { src: '/images/gallery/rabbi-liff-teaching.jpg', alt: 'Rabbi Liff teaching', label: 'Guidance' },
  { src: '/images/gallery/bochurim-2.jpg', alt: 'Growth and brotherhood', label: 'Brotherhood' },
];

// ── Smart image: shows real photo if available, else gold placeholder ──
function PlaceholderImg({
  src,
  label,
  className,
}: {
  src?: string;
  label: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`relative bg-gradient-to-br from-[#0d1b2a] to-[#0f0f13] flex items-center justify-center overflow-hidden ${className}`}
    >
      {/* Fallback pattern (always rendered underneath) */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(212,175,55,0.1) 10px, rgba(212,175,55,0.1) 11px)',
        }}
      />
      <div className="relative z-10 text-center pointer-events-none select-none">
        <div className="text-[#D4AF37]/60 text-5xl mb-3">✡</div>
        <p className="text-white/40 text-xs font-medium">{label}</p>
      </div>

      {/* Real image on top — hides placeholder when loaded */}
      {src && !failed && (
        <Image
          src={getImageSrc(src)}
          alt={label}
          fill
          className="object-cover z-20"
          onError={() => setFailed(true)}
          unoptimized
        />
      )}
    </div>
  );
}

// ── Animated Counter ─────────────────────────────────────────
function AnimCounter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const start = 0;
    const duration = 2000;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (ref.current) ref.current.textContent = `${Math.round(eased * to)}${suffix}`;
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, to, suffix]);
  return <span ref={ref} className="stat-number">0{suffix}</span>;
}

// ── Magnetic Bento Box ────────────────────────────────────────
function MagneticBox({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [4, -4]);
  const rotateY = useTransform(x, [-100, 100], [-4, 4]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * 0.3);
    y.set((e.clientY - cy) * 0.3);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Fade-in wrapper ───────────────────────────────────────────
function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN HOME PAGE
// ═══════════════════════════════════════════════════════════════
export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const [youtubeEmbedUrl, setYoutubeEmbedUrl] = useState<string | null>(null);

  // ── Fetch saved YouTube URL from settings ─────────────────
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: { youtubeUrl?: string }) => {
        if (data.youtubeUrl) {
          setYoutubeEmbedUrl(toEmbedUrl(data.youtubeUrl));
        }
      })
      .catch(() => {});
  }, []);

  // ── Hero GSAP text reveal ─────────────────────────────────
  useEffect(() => {
    if (!headlineRef.current || !subRef.current) return;

    const tl = gsap.timeline({ delay: 0.3 });

    // Split headline into words
    const headline = headlineRef.current;
    const words = headline.innerText.split(' ');
    headline.innerHTML = words
      .map(
        (w) =>
          `<span class="inline-block overflow-hidden"><span class="inline-block word-reveal">${w}</span></span>`
      )
      .join(' ');

    tl.fromTo(
      '.word-reveal',
      { y: '110%', opacity: 0, rotateX: -25 },
      {
        y: '0%',
        opacity: 1,
        rotateX: 0,
        duration: 1,
        stagger: 0.12,
        ease: 'power4.out',
      }
    )
      .fromTo(
        subRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' },
        '-=0.4'
      )
      .fromTo(
        '.hero-cta',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out' },
        '-=0.5'
      );
  }, []);

  // ── GSAP Horizontal Scroll ────────────────────────────────
  useEffect(() => {
    if (!scrollContainerRef.current || !scrollTrackRef.current) return;

    const track = scrollTrackRef.current;
    const totalWidth = track.scrollWidth - window.innerWidth;

    const ctx = gsap.context(() => {
      gsap.to(track, {
        x: () => -totalWidth,
        ease: 'none',
        scrollTrigger: {
          trigger: scrollContainerRef.current,
          start: 'top top',
          end: () => `+=${totalWidth * 1.2}`,
          pin: true,
          scrub: 1.2,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // Stagger image animations
      gsap.fromTo(
        '.scroll-card',
        { scale: 0.9, opacity: 0.6 },
        {
          scale: 1,
          opacity: 1,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: scrollContainerRef.current,
            start: 'top 80%',
            end: 'top top',
            scrub: true,
          },
        }
      );
    });

    return () => ctx.revert();
  }, []);

  return (
    <>
      {/* ════════════════════════════════════════════════════════
          SECTION 1: HERO
      ════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-obsidian"
      >
        {/* 3D Particle Background */}
        <div className="absolute inset-0 z-0">
          <HeroCanvas />
        </div>

        {/* Radial glow */}
        <div className="absolute inset-0 z-0 bg-glow-gold pointer-events-none" />

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-obsidian to-transparent z-10 pointer-events-none" />

        {/* Hero Content */}
        <div className="relative z-20 text-center px-6 max-w-6xl mx-auto">
          {/* Pre-title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="flex items-center justify-center gap-3 mb-8"
          >
            <div className="h-px w-16 bg-gold/40" />
            <span className="text-gold text-xs font-semibold tracking-[0.25em] uppercase">
              יְשִׁיבַת עֲטֶרֶת יַעֲקֹב
            </span>
            <div className="h-px w-16 bg-gold/40" />
          </motion.div>

          {/* Main Headline */}
          <h1
            ref={headlineRef}
            className="text-5xl md:text-7xl lg:text-8xl xl:text-9xl font-serif font-bold text-white leading-[0.95] mb-8 perspective-1000"
            style={{ perspective: '1000px' }}
          >
            Building Torah. Building Life.
          </h1>

          {/* Sub-headline */}
          <p
            ref={subRef}
            className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed font-light"
            style={{ opacity: 0 }}
          >
            A yeshiva where every bochur is seen, shaped, and sent forth to lead — under the
            guidance of Rabbi Yehoshua Liff and Rabbi Dov Ber Liff.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/support"
              className="hero-cta px-8 py-4 bg-gold text-obsidian font-bold text-base rounded-full hover:shadow-[0_0_40px_rgba(212,175,55,0.5)] transition-all hover:scale-105 active:scale-100 opacity-0"
            >
              Support the Yeshiva
            </Link>
            <Link
              href="/staff"
              className="hero-cta px-8 py-4 border border-white/20 text-white font-medium text-base rounded-full hover:border-gold/50 hover:text-gold transition-all opacity-0"
            >
              Meet the Hanhala →
            </Link>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          <span className="text-white/30 text-xs tracking-widest uppercase">Scroll</span>
          <motion.div
            className="w-px h-10 bg-gradient-to-b from-gold/60 to-transparent"
            animate={{ scaleY: [0, 1, 0], originY: 0 }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          />
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 2: HORIZONTAL SCROLL — "OUR WORLD"
      ════════════════════════════════════════════════════════ */}
      <section ref={scrollContainerRef} className="horizontal-scroll-container bg-obsidian">
        <div className="h-screen flex items-center overflow-hidden relative">
          {/* Scroll down hint */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-2">
            <span className="text-white/40 text-[10px] tracking-[0.25em] uppercase font-semibold">Scroll to explore</span>
            <motion.div
              animate={{ y: [0, 7, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-px h-5 bg-gradient-to-b from-transparent to-[#D4AF37]/50" />
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path d="M1 1l4 4 4-4" stroke="rgba(212,175,55,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.div>
          </div>

          <div ref={scrollTrackRef} className="flex gap-6 pl-[10vw] pr-[10vw] will-change-transform">
            {/* Intro card */}
            <div className="scroll-card flex-none w-[40vw] min-w-[320px] flex flex-col justify-center pr-16">
              <div className="h-px w-16 bg-gold/40 mb-6" />
              <h2 className="text-4xl md:text-6xl font-serif font-bold text-white mb-6 leading-tight">
                Life at the{' '}
                <span className="gold-shimmer">Yeshiva</span>
              </h2>
              <p className="text-white/50 text-lg leading-relaxed">
                From morning seder to late-night chavrusa — every moment is an opportunity
                to grow in Torah and become the best version of yourself.
              </p>
            </div>

            {/* Image Cards */}
            {scrollImages.map((img, i) => (
              <div
                key={i}
                className={`scroll-card flex-none rounded-2xl overflow-hidden border border-white/5 ${
                  i % 2 === 0 ? 'w-[35vw] h-[65vh] self-center' : 'w-[28vw] h-[50vh] self-end mb-8'
                }`}
              >
                <div className="relative w-full h-full group">
                  <PlaceholderImg src={img.src} label={img.alt} className="w-full h-full" />
                  <div className="absolute inset-0 bg-gradient-to-t from-obsidian/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 p-6">
                    <span className="text-gold text-xs tracking-widest uppercase font-semibold">
                      {img.label}
                    </span>
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
              </div>
            ))}

            {/* End card */}
            <div className="scroll-card flex-none w-[35vw] min-w-[280px] flex flex-col justify-center pl-16">
              <p className="text-gold/60 text-sm tracking-widest uppercase mb-4">Join Our Community</p>
              <h3 className="text-3xl md:text-4xl font-serif text-white mb-6 leading-tight">
                Ready to be part of something extraordinary?
              </h3>
              <Link
                href="/support"
                className="inline-block px-6 py-3 bg-gold text-obsidian font-semibold rounded-full hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all w-fit"
              >
                Support the Mission
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 3: MISSION STATEMENT
      ════════════════════════════════════════════════════════ */}
      <section className="py-32 px-6 bg-obsidian relative overflow-hidden">
        <div className="absolute inset-0 bg-glow-gold opacity-40 pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <FadeIn>
            <div className="text-gold/50 text-xs tracking-[0.3em] uppercase mb-6 font-semibold">
              Our Mission
            </div>
            <blockquote className="text-3xl md:text-5xl font-serif font-medium text-white leading-tight mb-10">
              "Every bochur who walks through our doors carries the potential for
              <span className="text-gold"> greatness</span> — our job is to help them
              discover it."
            </blockquote>
            <cite className="text-white/40 text-sm not-italic">
              — Rabbi Yehoshua Liff, Rosh Yeshiva
            </cite>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 4: BENTO GRID — MEDIA HUB
      ════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-obsidian-100">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <div className="text-gold/50 text-xs tracking-[0.3em] uppercase mb-4 font-semibold">
              Connect With Us
            </div>
            <h2 className="text-4xl md:text-6xl font-serif font-bold text-white">
              The Hub
            </h2>
          </FadeIn>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-[340px]">
            {/* YouTube — wide */}
            <MagneticBox className="lg:col-span-2 glass rounded-2xl overflow-hidden group">
              <div className="relative w-full h-full flex flex-col">
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-white/60 text-xs font-medium">Latest Torah Content</span>
                </div>
                <div className="flex-1 video-container">
                  {youtubeEmbedUrl ? (
                    <iframe
                      src={youtubeEmbedUrl}
                      title="Yeshiva Ateret Yaakov YouTube"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="rounded-none"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-black/40 gap-4">
                      <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center text-3xl">▶</div>
                      <div className="text-center">
                        <p className="text-white/60 text-sm font-semibold">No video set yet</p>
                        <p className="text-white/30 text-xs mt-1">Go to <span className="text-amber-400">/admin</span> → Video Settings to add a YouTube link</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 bg-gradient-to-t from-obsidian to-transparent absolute bottom-0 left-0 right-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold text-sm">Torah Shiurim & Content</p>
                      <p className="text-white/40 text-xs">@ישיבתעטרתיעקב on YouTube</p>
                    </div>
                    <a
                      href="https://www.youtube.com/@ישיבתעטרתיעקב"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 border border-red-500/40 text-red-400 text-xs rounded-full hover:bg-red-500/10 transition-colors"
                    >
                      Subscribe →
                    </a>
                  </div>
                </div>
              </div>
            </MagneticBox>

            {/* Instagram */}
            <MagneticBox className="glass rounded-2xl overflow-hidden flex flex-col">
              <div className="p-5 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center text-xs font-bold text-white">
                    IG
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">@liffs_yeshiva</p>
                    <p className="text-white/40 text-xs">Instagram</p>
                  </div>
                </div>
                <a
                  href="https://www.instagram.com/liffs_yeshiva/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gold hover:text-gold/80 font-medium"
                >
                  Follow →
                </a>
              </div>
              <div className="flex-1 grid grid-cols-3 gap-0.5 p-0.5">
                {[1,2,3,4,5,6].map((n) => (
                  <div
                    key={n}
                    className="aspect-square relative overflow-hidden hover:opacity-80 transition-opacity cursor-pointer bg-[#0d1b2a]"
                  >
                    <PlaceholderImg
                      src={`/images/gallery/photo-${n}.png`}
                      label=""
                      className="w-full h-full"
                    />
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-white/5">
                <p className="text-white/40 text-xs text-center">
                  Follow for daily Torah inspiration & yeshiva life
                </p>
              </div>
            </MagneticBox>

            {/* CauseMatch Campaign */}
            <MagneticBox className="relative glass rounded-2xl overflow-hidden animate-glow-pulse">
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent pointer-events-none" />
              <div className="relative h-full p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                    <span className="text-gold text-xs font-semibold tracking-wider uppercase">
                      Live Campaign
                    </span>
                  </div>
                  <h3 className="text-white text-xl font-serif font-bold mb-2">
                    CauseMatch Campaign
                  </h3>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Support our bochurim's Torah journey. Every dollar matched — double the
                    impact.
                  </p>
                </div>
                <div>
                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-white/40 mb-1.5">
                      <span>Campaign Progress</span>
                      <span className="text-gold font-semibold">
                        <AnimCounter to={73} suffix="%" />
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gold rounded-full"
                        initial={{ width: 0 }}
                        whileInView={{ width: '73%' }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.5, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href="https://causematch.com/yay"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 bg-gold text-obsidian font-bold text-sm rounded-xl text-center hover:bg-gold/90 transition-colors"
                    >
                      Donate on CauseMatch
                    </a>
                  </div>
                </div>
              </div>
            </MagneticBox>

            {/* Stats Box */}
            <MagneticBox className="glass rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="text-gold/50 text-xs tracking-widest uppercase mb-4 font-semibold">
                  Yeshiva by the Numbers
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Bochurim', value: 40, suffix: '+' },
                    { label: 'Years Strong', value: 10, suffix: '+' },
                    { label: 'Alumni', value: 200, suffix: '+' },
                    { label: 'Daily Chaburos', value: 8, suffix: '' },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center">
                      <div className="text-3xl font-bold text-white mb-1">
                        <AnimCounter to={stat.value} suffix={stat.suffix} />
                      </div>
                      <div className="text-white/40 text-xs">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="divider-gold my-4" />
              <div>
                <p className="text-white/30 text-xs text-center">
                  Growing stronger every year through Torah and dedication
                </p>
              </div>
            </MagneticBox>

            {/* CharityExtra */}
            <MagneticBox className="glass rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-navy/40 rounded-full -translate-y-20 translate-x-20 blur-3xl" />
              <div>
                <div className="text-xs text-gold/60 font-semibold tracking-widest uppercase mb-3">
                  UK Donors — Tax Relief
                </div>
                <h3 className="text-white text-xl font-serif font-bold mb-2">
                  CharityExtra
                </h3>
                <p className="text-white/50 text-sm">
                  UK-based? Donate through CharityExtra and qualify for Gift Aid — maximise
                  your impact at no extra cost.
                </p>
              </div>
              <a
                href="https://www.charityextra.com/ay"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 py-3 border border-gold/30 text-gold font-semibold text-sm rounded-xl text-center hover:bg-gold/10 hover:border-gold/60 transition-all"
              >
                Donate via CharityExtra →
              </a>
            </MagneticBox>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 5: MEET THE HANHALA (PREVIEW)
      ════════════════════════════════════════════════════════ */}
      <section className="py-32 px-6 bg-obsidian relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-navy/20 blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto relative z-10">
          <FadeIn className="flex flex-col md:flex-row items-start md:items-end justify-between mb-16 gap-6">
            <div>
              <div className="text-gold/50 text-xs tracking-[0.3em] uppercase mb-4 font-semibold">
                Leadership
              </div>
              <h2 className="text-4xl md:text-6xl font-serif font-bold text-white">
                Meet the<br />
                <span className="gold-shimmer">Hanhala</span>
              </h2>
            </div>
            <Link
              href="/staff"
              className="px-6 py-3 border border-white/10 text-white/70 rounded-full text-sm hover:border-gold/50 hover:text-gold transition-all"
            >
              View Full Team →
            </Link>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Rabbi Yehoshua Liff',
                title: 'Rosh Yeshiva',
                bio: 'Graduate of Yeshivat Ner Israel of Baltimore, founder of Yeshivat Ner Yaacov of Jerusalem. A visionary leader who has dedicated his life to building the next generation of Torah leaders.',
                img: '/images/staff/rabbi-yehoshua-liff.jpg',
              },
              {
                name: 'Rabbi Dov Ber Liff',
                title: 'Rosh Yeshiva',
                bio: 'Graduate of Yeshivat Givat Shaul. His genuine warmth and individual care for every bochur sets the tone for the entire yeshiva. An exceptional educator with decades of experience.',
                img: '/images/staff/rabbi-dov-ber-liff.jpg',
              },
              {
                name: 'Rabbi Larry Shain',
                title: 'Mashgiach & Administrator',
                bio: 'Co-founder and CEO of Ohr Somayach South Africa for 25 years. Brings deep professional wisdom and a warm heart to guiding each bochur on their personal journey.',
                img: '/images/staff/rabbi-larry-shain.jpg',
              },
            ].map((rabbi, i) => (
              <FadeIn key={rabbi.name} delay={i * 0.1}>
                <Link href="/staff" className="group block">
                  <div className="glass rounded-2xl overflow-hidden border border-white/5 hover:border-gold/20 transition-all duration-500">
                    <div className="relative h-72 overflow-hidden">
                      <PlaceholderImg src={rabbi.img} label={rabbi.name} className="w-full h-full" />
                      <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-transparent to-transparent" />
                    </div>
                    <div className="p-6">
                      <div className="text-gold text-xs font-semibold tracking-widest uppercase mb-2">
                        {rabbi.title}
                      </div>
                      <h3 className="text-white text-xl font-serif font-bold mb-3 group-hover:text-gold transition-colors">
                        {rabbi.name}
                      </h3>
                      <p className="text-white/50 text-sm leading-relaxed line-clamp-3">
                        {rabbi.bio}
                      </p>
                    </div>
                  </div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 6: FINAL CTA
      ════════════════════════════════════════════════════════ */}
      <section className="py-40 px-6 bg-obsidian-100 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-obsidian via-navy/20 to-obsidian pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gold/5 blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <FadeIn>
            <div className="text-gold/50 text-xs tracking-[0.3em] uppercase mb-6 font-semibold">
              Partner With Us
            </div>
            <h2 className="text-5xl md:text-7xl font-serif font-bold text-white mb-8 leading-tight">
              Be Part of the{' '}
              <span className="gold-shimmer">Story</span>
            </h2>
            <p className="text-white/50 text-lg mb-12 max-w-2xl mx-auto leading-relaxed">
              Your support empowers bochurim to reach their potential. Every donation is an
              investment in the future of Torah, with matching opportunities available.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://causematch.com/yay"
                target="_blank"
                rel="noopener noreferrer"
                className="px-10 py-5 bg-gold text-obsidian font-bold text-lg rounded-full hover:shadow-[0_0_50px_rgba(212,175,55,0.5)] hover:scale-105 transition-all active:scale-100 glow-gold"
              >
                Donate on CauseMatch
              </a>
              <a
                href="https://www.charityextra.com/ay"
                target="_blank"
                rel="noopener noreferrer"
                className="px-10 py-5 border border-gold/30 text-gold font-semibold text-lg rounded-full hover:bg-gold/10 hover:border-gold/60 transition-all"
              >
                CharityExtra (UK)
              </a>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
