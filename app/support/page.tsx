'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// ── Donation tiers ────────────────────────────────────────────
const tiers = [
  {
    amount: 18,
    label: 'Chai',
    hebrew: 'חי',
    description: 'Support a bochur\'s daily coffee and focus.',
    emoji: '☕',
  },
  {
    amount: 100,
    label: 'Sponsor a Sefer',
    hebrew: 'ספר',
    description: 'Put a sefer in the hands of a learning bochur.',
    emoji: '📖',
  },
  {
    amount: 360,
    label: 'Sponsor a Shabbos',
    hebrew: 'שבת',
    description: 'Give bochurim a Shabbos meal filled with warmth and Torah.',
    emoji: '🕯️',
    highlight: true,
  },
  {
    amount: 1000,
    label: 'Sponsor a Month',
    hebrew: 'חודש',
    description: 'Cover one month\'s learning costs for a single talmid.',
    emoji: '📅',
  },
  {
    amount: 5000,
    label: 'Major Benefactor',
    hebrew: 'תורם נכבד',
    description: 'Make a lasting impact on the future of Torah in our community.',
    emoji: '🌟',
  },
];

// ── Impact items ──────────────────────────────────────────────
const impacts = [
  {
    icon: '📚',
    title: 'World-Class Learning',
    description:
      'Your donation funds top-tier Rebbeim, seforim, and a learning environment that inspires greatness.',
  },
  {
    icon: '🤝',
    title: 'Individual Attention',
    description:
      'Small class sizes mean every bochur gets the personal guidance that shapes his character and career.',
  },
  {
    icon: '🌍',
    title: 'Creating Leaders',
    description:
      'Alumni of Ateret Yaakov are leading communities, families, and businesses around the world.',
  },
  {
    icon: '❤️',
    title: 'A Family for Life',
    description:
      'The bonds formed at Ateret Yaakov last a lifetime — in Torah and in friendship.',
  },
];

// ── Animated Number ───────────────────────────────────────────
function AnimNum({ to, prefix = '' }: { to: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const dur = 2000;
    const start = performance.now();
    const anim = (now: number) => {
      const progress = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (ref.current) ref.current.textContent = `${prefix}${Math.round(eased * to).toLocaleString()}`;
      if (progress < 1) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }, [inView, to, prefix]);
  return <span ref={ref}>{prefix}0</span>;
}

// ── Magnetic donation button ──────────────────────────────────
function DonationTier({
  tier,
  index,
  onSelect,
}: {
  tier: (typeof tiers)[0];
  index: number;
  onSelect: (amount: number) => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      onClick={() => onSelect(tier.amount)}
      whileHover={{
        y: -6,
        scale: 1.03,
        boxShadow: tier.highlight
          ? '0 20px 60px rgba(212,175,55,0.35)'
          : '0 20px 40px rgba(212,175,55,0.15)',
      }}
      whileTap={{ scale: 0.97 }}
      className={`relative group text-left p-6 rounded-2xl border transition-all duration-300 w-full ${
        tier.highlight
          ? 'bg-gold/15 border-gold/40 shadow-[0_0_30px_rgba(212,175,55,0.2)]'
          : 'glass border-white/8 hover:border-gold/20'
      }`}
    >
      {tier.highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 bg-gold text-obsidian text-xs font-bold rounded-full">
            Most Popular
          </span>
        </div>
      )}
      <div className="flex items-start justify-between mb-4">
        <div className="text-3xl">{tier.emoji}</div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${tier.highlight ? 'text-gold' : 'text-white'}`}>
            ${tier.amount.toLocaleString()}
          </div>
          <div className="text-white/40 text-xs rtl font-hebrew">{tier.hebrew}</div>
        </div>
      </div>
      <div className={`text-base font-semibold mb-2 ${tier.highlight ? 'text-gold' : 'text-white'}`}>
        {tier.label}
      </div>
      <div className="text-white/50 text-sm leading-relaxed">{tier.description}</div>
      <div
        className={`mt-4 py-2.5 rounded-xl text-center text-sm font-semibold transition-all ${
          tier.highlight
            ? 'bg-gold text-obsidian group-hover:bg-gold/90'
            : 'border border-white/10 text-white/60 group-hover:border-gold/30 group-hover:text-white'
        }`}
      >
        Donate ${tier.amount.toLocaleString()} →
      </div>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUPPORT PAGE
// ═══════════════════════════════════════════════════════════════
export default function SupportPage() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [showThankYou, setShowThankYou] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!headerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        headerRef.current!.querySelectorAll('.anim-target'),
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, stagger: 0.15, ease: 'power3.out', delay: 0.2 }
      );

      // Scroll-triggered parallax on gold orbs
      gsap.to('.hero-orb-1', {
        y: -80,
        ease: 'none',
        scrollTrigger: { trigger: headerRef.current, scrub: 2 },
      });
      gsap.to('.hero-orb-2', {
        y: -40,
        ease: 'none',
        scrollTrigger: { trigger: headerRef.current, scrub: 3 },
      });
    });
    return () => ctx.revert();
  }, []);

  const handleDonate = (platform: 'causematch' | 'charityextra') => {
    const urls = {
      causematch: 'https://causematch.com/yay',
      charityextra: 'https://www.charityextra.com/ay',
    };
    window.open(urls[platform], '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-obsidian overflow-hidden">
      {/* ════════════════════════════════════════════════════════
          HERO SECTION
      ════════════════════════════════════════════════════════ */}
      <section className="relative pt-40 pb-32 px-6 overflow-hidden">
        {/* Background orbs */}
        <div className="hero-orb-1 absolute top-20 left-1/4 w-96 h-96 rounded-full bg-gold/8 blur-3xl pointer-events-none" />
        <div className="hero-orb-2 absolute top-40 right-1/4 w-80 h-80 rounded-full bg-navy/40 blur-3xl pointer-events-none" />

        <div ref={headerRef} className="max-w-4xl mx-auto text-center relative z-10">
          <div className="anim-target text-gold/50 text-xs tracking-[0.3em] uppercase mb-6 font-semibold">
            Partner With Us
          </div>
          <h1 className="anim-target text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-white mb-8 leading-[0.9]">
            Invest in<br />
            <span className="gold-shimmer">Torah's Future</span>
          </h1>
          <p className="anim-target text-white/60 text-xl max-w-2xl mx-auto leading-relaxed mb-12">
            Every dollar you give is multiplied — in Torah learned, in character built,
            in lives transformed. Join the family of Ateret Yaakov supporters.
          </p>

          {/* Big CTA buttons */}
          <div className="anim-target flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              whileHover={{
                scale: 1.05,
                boxShadow: '0 0 60px rgba(212,175,55,0.5)',
              }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleDonate('causematch')}
              className="px-10 py-5 bg-gold text-obsidian font-bold text-xl rounded-full glow-gold hover:bg-gold/95 transition-all flex items-center gap-3"
            >
              <span>Donate on CauseMatch</span>
              <span className="text-base">→</span>
            </motion.button>
            <motion.button
              whileHover={{
                scale: 1.05,
                borderColor: 'rgba(212,175,55,0.6)',
              }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleDonate('charityextra')}
              className="px-10 py-5 border border-gold/30 text-gold font-semibold text-xl rounded-full hover:bg-gold/8 transition-all flex items-center gap-3"
            >
              <span>CharityExtra (UK)</span>
              <span className="text-base">→</span>
            </motion.button>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          LIVE STATS BAR
      ════════════════════════════════════════════════════════ */}
      <div className="border-y border-white/5 bg-white/2 py-8 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: 'Donors This Campaign', value: 847, prefix: '' },
            { label: 'Raised So Far', value: 183500, prefix: '$' },
            { label: 'Bochurim Supported', value: 40, prefix: '' },
            { label: 'Match Multiplier', value: 2, prefix: '×' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl md:text-4xl font-bold text-gold mb-1">
                <AnimNum to={stat.value} prefix={stat.prefix} />
              </div>
              <div className="text-white/40 text-xs uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          DONATION TIERS
      ════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-obsidian">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="text-gold/50 text-xs tracking-[0.3em] uppercase mb-4 font-semibold">
              Choose Your Impact
            </div>
            <h2 className="text-4xl md:text-6xl font-serif font-bold text-white">
              Make It Meaningful
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-12">
            {tiers.map((tier, i) => (
              <DonationTier
                key={tier.label}
                tier={tier}
                index={i}
                onSelect={(amount) => {
                  setSelectedAmount(amount);
                  handleDonate('causematch');
                }}
              />
            ))}
          </div>

          {/* Custom Amount */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-8 border border-white/5 max-w-xl mx-auto text-center"
          >
            <h3 className="text-white font-serif text-2xl font-bold mb-2">Custom Amount</h3>
            <p className="text-white/40 text-sm mb-6">
              Give what speaks to your heart — every amount makes a difference.
            </p>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gold text-xl font-bold">
                  $
                </span>
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none text-lg"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => customAmount && handleDonate('causematch')}
                disabled={!customAmount}
                className="px-6 py-4 bg-gold text-obsidian font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold/90 transition-colors"
              >
                Donate →
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          WHY DONATE — IMPACT
      ════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-obsidian-100">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="text-gold/50 text-xs tracking-[0.3em] uppercase mb-4 font-semibold">
              Your Impact
            </div>
            <h2 className="text-4xl md:text-6xl font-serif font-bold text-white">
              Where It Goes
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {impacts.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                whileHover={{ y: -5 }}
                className="glass rounded-2xl p-6 border border-white/5 hover:border-gold/15 transition-all"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-white font-semibold text-lg mb-3">{item.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          TESTIMONY / QUOTE
      ════════════════════════════════════════════════════════ */}
      <section className="py-32 px-6 bg-obsidian relative overflow-hidden">
        <div className="absolute inset-0 bg-glow-gold opacity-30 pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="text-gold text-7xl font-serif leading-none mb-6 opacity-40">"</div>
            <blockquote className="text-3xl md:text-4xl lg:text-5xl font-serif font-medium text-white leading-tight mb-8">
              Ateret Yaakov didn't just teach me Torah — it taught me who I am and who I
              can become.
            </blockquote>
            <cite className="text-white/40 text-sm not-italic block mb-12">
              — Alumnus, Class of 2022
            </cite>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 0 50px rgba(212,175,55,0.45)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleDonate('causematch')}
                className="px-10 py-5 bg-gold text-obsidian font-bold text-xl rounded-full glow-gold transition-all"
              >
                Donate on CauseMatch
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleDonate('charityextra')}
                className="px-10 py-5 border border-gold/30 text-gold font-semibold text-xl rounded-full hover:bg-gold/8 transition-all"
              >
                Donate via CharityExtra
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          PLATFORM INFO CARDS
      ════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-obsidian-100">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-serif font-bold text-white">
              Choose Your Platform
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CauseMatch */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass rounded-2xl p-8 border border-gold/15 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full -translate-y-16 translate-x-16" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gold/20 flex items-center justify-center text-gold text-2xl font-bold mb-4">
                  C
                </div>
                <h3 className="text-white text-2xl font-serif font-bold mb-2">CauseMatch</h3>
                <p className="text-white/50 text-sm mb-6 leading-relaxed">
                  Israel's leading Jewish crowdfunding platform with real-time matching.
                  Every donation is doubled — maximizing your impact instantly.
                </p>
                <div className="flex flex-col gap-2 mb-6 text-sm">
                  {[
                    '✓ Donations matched in real time',
                    '✓ Accepts international cards',
                    '✓ Tax deductible (US & IL)',
                    '✓ Secure & trusted platform',
                  ].map((item) => (
                    <div key={item} className="text-white/60">
                      {item}
                    </div>
                  ))}
                </div>
                <motion.button
                  whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(212,175,55,0.4)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleDonate('causematch')}
                  className="w-full py-4 bg-gold text-obsidian font-bold text-lg rounded-xl hover:bg-gold/90 transition-colors"
                >
                  Donate on CauseMatch →
                </motion.button>
              </div>
            </motion.div>

            {/* CharityExtra */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass rounded-2xl p-8 border border-white/8 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-navy/30 rounded-full -translate-y-16 translate-x-16" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white text-2xl font-bold mb-4">
                  CE
                </div>
                <h3 className="text-white text-2xl font-serif font-bold mb-2">
                  CharityExtra
                </h3>
                <p className="text-white/50 text-sm mb-6 leading-relaxed">
                  The premier platform for UK-based donors. Claim Gift Aid and add 25%
                  to your donation at no extra cost to you.
                </p>
                <div className="flex flex-col gap-2 mb-6 text-sm">
                  {[
                    '✓ UK Gift Aid eligible',
                    '✓ 25% extra added automatically',
                    '✓ Secure UK charity platform',
                    '✓ Full UK tax receipts',
                  ].map((item) => (
                    <div key={item} className="text-white/60">
                      {item}
                    </div>
                  ))}
                </div>
                <motion.button
                  whileHover={{ scale: 1.03, borderColor: 'rgba(212,175,55,0.5)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleDonate('charityextra')}
                  className="w-full py-4 border border-gold/25 text-gold font-bold text-lg rounded-xl hover:bg-gold/8 hover:border-gold/50 transition-all"
                >
                  Donate via CharityExtra →
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          CONTACT / QUESTIONS
      ════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 bg-obsidian border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-white font-serif text-3xl font-bold mb-4">
              Questions About Giving?
            </h3>
            <p className="text-white/40 text-base mb-8 leading-relaxed">
              We'd love to speak with you personally. Whether you're considering a major
              gift or want to learn more about our programs, our door is always open.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:info@ateretyaakov.com"
                className="px-6 py-3 glass border border-white/10 text-white/70 rounded-full hover:border-gold/30 hover:text-white transition-all text-sm"
              >
                📧 info@ateretyaakov.com
              </a>
              <a
                href="https://www.instagram.com/liffs_yeshiva/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 glass border border-white/10 text-white/70 rounded-full hover:border-gold/30 hover:text-white transition-all text-sm"
              >
                📸 @liffs_yeshiva
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
