'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ── Gallery items ─────────────────────────────────────────────
const galleryItems = [
  { id: 1,  src: '/images/gallery/photo-1.png',  label: 'Morning Seder',       category: 'Learning',    aspect: 'tall'   },
  { id: 2,  src: '/images/gallery/photo-2.png',  label: 'Shiur with Rebbe',    category: 'Learning',    aspect: 'wide'   },
  { id: 3,  src: '/images/gallery/photo-3.png',  label: 'Shabbos Together',    category: 'Community',   aspect: 'square' },
  { id: 4,  src: '/images/gallery/photo-4.png',  label: 'Beis Medrash',        category: 'Learning',    aspect: 'tall'   },
  { id: 5,  src: '/images/gallery/photo-5.png',  label: 'Simcha Night',        category: 'Events',      aspect: 'wide'   },
  { id: 6,  src: '/images/gallery/photo-6.png',  label: 'Chavrusa Learning',   category: 'Learning',    aspect: 'square' },
  { id: 7,  src: '/images/gallery/photo-7.png',  label: 'Rabbi Liff Shiur',    category: 'Learning',    aspect: 'tall'   },
  { id: 8,  src: '/images/gallery/photo-8.png',  label: 'Yom Tov Meal',        category: 'Community',   aspect: 'wide'   },
  { id: 9,  src: '/images/gallery/photo-9.png',  label: 'Late Night Learning', category: 'Learning',    aspect: 'square' },
  { id: 10, src: '/images/gallery/photo-10.png', label: 'Chanukah Celebration',category: 'Events',      aspect: 'tall'   },
  { id: 11, src: '/images/gallery/photo-11.png', label: 'Sports Day',          category: 'Recreation',  aspect: 'wide'   },
  { id: 12, src: '/images/gallery/photo-12.png', label: 'Siyum Celebration',   category: 'Events',      aspect: 'square' },
  { id: 13, src: '/images/gallery/photo-13.png', label: 'Bochurim Bonding',    category: 'Community',   aspect: 'tall'   },
  { id: 14, src: '/images/gallery/photo-14.png', label: 'Musical Night',       category: 'Events',      aspect: 'wide'   },
  { id: 15, src: '/images/gallery/photo-15.png', label: 'Rosh Hashana',        category: 'Community',   aspect: 'square' },
  { id: 16, src: '/images/gallery/photo-16.png', label: 'Hiking Trip',         category: 'Recreation',  aspect: 'tall'   },
];

const categories = ['All', 'Learning', 'Community', 'Events', 'Recreation'];

// ── Height map per aspect ─────────────────────────────────────
const aspectHeights: Record<string, string> = {
  tall: 'h-96',
  wide: 'h-56',
  square: 'h-72',
};

// ── Placeholder card ──────────────────────────────────────────
function GalleryCard({
  item,
  index,
  onClick,
}: {
  item: (typeof galleryItems)[0];
  index: number;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // GSAP parallax on scroll
  useEffect(() => {
    if (!ref.current) return;
    const speed = 0.06 + (index % 3) * 0.03;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { y: 40 },
        {
          y: -40,
          ease: 'none',
          scrollTrigger: {
            trigger: ref.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: speed * 10,
          },
        }
      );
    });
    return () => ctx.revert();
  }, [index]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, delay: (index % 3) * 0.1, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      className={`masonry-grid-item rounded-2xl overflow-hidden cursor-pointer border border-white/5 hover:border-gold/20 group transition-colors duration-500 ${aspectHeights[item.aspect]}`}
    >
      <div className="relative w-full h-full bg-gradient-to-br from-[#0d1b2a] to-[#0f0f13] overflow-hidden">
        {/* Fallback pattern shown when image is missing */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(
              ${45 + index * 10}deg,
              transparent,
              transparent 15px,
              rgba(212,175,55,${0.05 + (index % 4) * 0.02}) 15px,
              rgba(212,175,55,${0.05 + (index % 4) * 0.02}) 16px
            )`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-[#D4AF37]/30 text-4xl">✡</div>
        </div>

        {/* Real image — covers placeholder when loaded */}
        {item.src && (
          <Image
            src={item.src}
            alt={item.label}
            fill
            className="object-cover z-10"
            unoptimized
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian/90 via-obsidian/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

        {/* Category badge */}
        <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-y-1 group-hover:translate-y-0">
          <span className="px-2.5 py-1 bg-gold/90 text-obsidian text-xs font-bold rounded-full">
            {item.category}
          </span>
        </div>

        {/* Label on hover */}
        <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-400">
          <p className="text-white font-semibold text-sm leading-tight">{item.label}</p>
        </div>

        {/* Zoom icon */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white text-xl">
            ⊕
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Lightbox ──────────────────────────────────────────────────
function Lightbox({
  item,
  onClose,
  onPrev,
  onNext,
}: {
  item: (typeof galleryItems)[0];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        key="lb-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-obsidian/95 backdrop-blur-2xl"
      />
      <motion.div
        key="lb-content"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-8 lg:inset-20 z-[51] flex flex-col items-center justify-center gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image area */}
        <div className="w-full flex-1 rounded-2xl overflow-hidden relative border border-white/10 bg-[#0d1b2a] flex items-center justify-center">
          {/* Fallback */}
          <div className="text-center absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[#D4AF37]/20 text-8xl mb-6">✡</div>
            <p className="text-white/30 font-semibold">{item.label}</p>
          </div>
          {/* Real image */}
          {item.src && (
            <Image
              src={item.src}
              alt={item.label}
              fill
              className="object-contain z-10"
              unoptimized
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          {/* Nav buttons */}
          <button
            onClick={onPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition-colors"
          >
            ←
          </button>
          <button
            onClick={onNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition-colors"
          >
            →
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between w-full">
          <div>
            <p className="text-white font-semibold">{item.label}</p>
            <p className="text-white/40 text-sm">{item.category}</p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-white/10 text-white/60 rounded-full text-sm hover:border-gold/30 hover:text-white transition-all"
          >
            Close ×
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════
// GALLERY PAGE
// ═══════════════════════════════════════════════════════════════
export default function GalleryPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [lightboxItem, setLightboxItem] = useState<(typeof galleryItems)[0] | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const filtered =
    activeCategory === 'All'
      ? galleryItems
      : galleryItems.filter((item) => item.category === activeCategory);

  useEffect(() => {
    if (!headerRef.current) return;
    gsap.fromTo(
      headerRef.current.querySelectorAll('.anim-target'),
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.9, stagger: 0.15, ease: 'power3.out', delay: 0.2 }
    );
  }, []);

  const handlePrev = () => {
    if (!lightboxItem) return;
    const idx = filtered.findIndex((i) => i.id === lightboxItem.id);
    setLightboxItem(filtered[(idx - 1 + filtered.length) % filtered.length]);
  };

  const handleNext = () => {
    if (!lightboxItem) return;
    const idx = filtered.findIndex((i) => i.id === lightboxItem.id);
    setLightboxItem(filtered[(idx + 1) % filtered.length]);
  };

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!lightboxItem) return;
      if (e.key === 'Escape') setLightboxItem(null);
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxItem, filtered]);

  return (
    <div className="min-h-screen bg-obsidian pt-32 pb-24 px-6">
      {/* Header */}
      <div ref={headerRef} className="max-w-7xl mx-auto mb-16 text-center">
        <div className="anim-target text-gold/50 text-xs tracking-[0.3em] uppercase mb-4 font-semibold">
          Photo Gallery
        </div>
        <h1 className="anim-target text-5xl md:text-7xl font-serif font-bold text-white mb-6">
          Life at{' '}
          <span className="gold-shimmer">Ateret Yaakov</span>
        </h1>
        <p className="anim-target text-white/50 text-lg max-w-xl mx-auto leading-relaxed">
          Glimpses into the learning, growth, and camaraderie that define our yeshiva.
        </p>
      </div>

      {/* Category Filter */}
      <div className="max-w-7xl mx-auto mb-12 flex flex-wrap items-center justify-center gap-3">
        {categories.map((cat) => (
          <motion.button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
              activeCategory === cat
                ? 'bg-gold text-obsidian shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                : 'border border-white/10 text-white/60 hover:border-gold/30 hover:text-white'
            }`}
          >
            {cat}
          </motion.button>
        ))}
      </div>

      {/* Instagram CTA */}
      <div className="max-w-7xl mx-auto mb-12">
        <a
          href="https://www.instagram.com/liffs_yeshiva/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 py-4 glass rounded-2xl border border-white/5 hover:border-gold/20 transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center text-xs font-bold text-white">
            IG
          </div>
          <span className="text-white/60 text-sm group-hover:text-white transition-colors">
            Follow{' '}
            <span className="text-gold font-semibold">@liffs_yeshiva</span> for daily
            photos & reels
          </span>
          <span className="text-white/30 group-hover:text-gold transition-colors">→</span>
        </a>
      </div>

      {/* Masonry Grid */}
      <div className="max-w-7xl mx-auto">
        <motion.div
          layout
          className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 masonry-grid"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((item, i) => (
              <GalleryCard
                key={item.id}
                item={item}
                index={i}
                onClick={() => setLightboxItem(item)}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-24 text-white/30">
            No items in this category yet.
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="max-w-7xl mx-auto mt-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <p className="text-white/40 text-sm mb-6">
            Want to share this moment with someone special?
          </p>
          <a
            href="https://causematch.com/yay"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 bg-gold text-obsidian font-bold rounded-full hover:shadow-[0_0_40px_rgba(212,175,55,0.4)] transition-all hover:scale-105"
          >
            Support These Moments →
          </a>
        </motion.div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxItem && (
          <Lightbox
            item={lightboxItem}
            onClose={() => setLightboxItem(null)}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
