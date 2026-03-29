'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { gsap } from 'gsap';

// ── Staff data ────────────────────────────────────────────────
const staffMembers = [
  {
    id: 1,
    name: 'Rabbi Yehoshua Liff',
    hebrewName: 'הרב יהושע ליף',
    title: 'Rosh Yeshiva',
    image: '/images/staff/rabbi-yehoshua-liff.jpg',
    bio: `Rabbi Yehoshua Liff is a graduate of the prestigious Yeshivat Ner Israel of Baltimore, Maryland, one of the foremost yeshivos in North America. He went on to found Yeshivat Ner Yaacov in Jerusalem, a highly recognized and respected institution that produced generations of talmidim.

Drawing on decades of experience in chinuch and yeshiva leadership, Rabbi Yehoshua Liff co-founded Yeshiva Ateret Yaakov with a singular vision: to create an environment where every bochur is truly seen, guided, and elevated to his fullest potential.

His shiurim are renowned for their clarity, depth, and real-world relevance. Rabbi Liff has an extraordinary ability to make complex sugyos come alive and connect timeless Torah wisdom to the world his talmidim inhabit.`,
    expertise: ['Gemara & Halacha', 'Machshava', 'Leadership', 'Hashkafa'],
    videoId: 'dQw4w9WgXcQ',
  },
  {
    id: 2,
    name: 'Rabbi Dov Ber Liff',
    hebrewName: 'הרב דב בר ליף',
    title: 'Rosh Yeshiva',
    image: '/images/staff/rabbi-dov-ber-liff.jpg',
    bio: `Rabbi Dov Ber Liff is a graduate of Yeshivat Givat Shaul, where he developed the deep learning and warm mentorship style that has become his hallmark. He co-founded Chemdas Hatorah, a highly successful Yeshiva Ketana in Bet Shemesh, before going on to establish Ateret Yaakov together with his father.

What sets Rabbi Dov Ber apart is his genuine warmth and individual concern for every single bochur. Talmidim describe feeling truly known and cared for — not as part of a crowd, but as individuals with unique strengths and challenges.

His approach to chinuch combines rigorous Torah scholarship with deep emotional intelligence. He helps bochurim not only learn but grow into themselves — into men who are ready for the world.`,
    expertise: ['Chavrusa Learning', 'Character Development', 'Individual Guidance', 'Iyun'],
    videoId: 'dQw4w9WgXcQ',
  },
  {
    id: 3,
    name: 'Rabbi Larry Shain',
    hebrewName: 'הרב לארי שיין',
    title: 'Mashgiach & Administrator',
    image: '/images/staff/rabbi-larry-shain.jpg',
    bio: `Rabbi Larry Shain served as co-founder and CEO of Ohr Somayach of South Africa for 25 years, building a world-class kiruv and educational institution from the ground up. The professional acumen, passion for Torah, and care for every student he developed there now powers Ateret Yaakov's administration and spiritual guidance.

As Mashgiach, Rabbi Shain brings a unique blend of business professionalism and heartfelt pastoral care. He oversees the wellbeing of each bochur, ensuring the yeshiva operates with the warmth of a family and the excellence of a world-class institution.

His door is always open. Whether a bochur needs practical guidance, emotional support, or a listening ear, Rabbi Shain is there — drawing on a lifetime of experience helping young men find their way.`,
    expertise: ['Pastoral Care', 'Administration', 'Life Guidance', 'Mussar'],
    videoId: 'dQw4w9WgXcQ',
  },
  {
    id: 4,
    name: 'Rabbi Avi Cohen',
    hebrewName: 'הרב אבי כהן',
    title: 'Senior Maggid Shiur',
    image: '/images/staff/rabbi-avi-cohen.jpg',
    bio: `Rabbi Avi Cohen delivers the daily Gemara shiur with extraordinary energy and clarity. A sought-after educator with years of experience in yeshivos across Israel and America, he brings each sugya to life with creative questions and sharp analysis.

His shiurim are a highlight of the day — bochurim arrive early and stay late discussing the ideas he raises. Rabbi Cohen is committed to producing genuine talmidei chachamim who can learn independently with depth and joy.`,
    expertise: ['Gemara Shiur', 'Bekius', 'Chakirah', 'Tosfos'],
    videoId: 'dQw4w9WgXcQ',
  },
  {
    id: 5,
    name: 'Rabbi Moshe Weiss',
    hebrewName: 'הרב משה ווייס',
    title: 'Seder Rishon Rebbi',
    image: '/images/staff/rabbi-moshe-weiss.jpg',
    bio: `Rabbi Moshe Weiss oversees the morning seder — the backbone of the yeshiva's learning schedule. With patience and precision, he helps bochurim develop the skills and habits of serious Torah learning.

He is particularly skilled at identifying a bochur's learning style and tailoring his guidance accordingly. Under his watch, even bochurim who struggled in the past discover they are capable learners who can grow to love Torah.`,
    expertise: ['Morning Seder', 'Learning Skills', 'Beki\'ut', 'One-on-One Coaching'],
    videoId: 'dQw4w9WgXcQ',
  },
  {
    id: 6,
    name: 'Rabbi Nachman Berger',
    hebrewName: 'הרב נחמן ברגר',
    title: 'Seder Sheni Maggid Shiur',
    image: '/images/staff/rabbi-nachman-berger.jpg',
    bio: `Rabbi Nachman Berger leads the afternoon seder with a focus on Halacha LeMa'aseh and practical Torah application. His shiurim connect the Gemara to everyday life in ways that resonate deeply with his talmidim.

He also runs the yeshiva's popular weekly mussar vaad, which is considered among the most impactful parts of the week by many bochurim and alumni.`,
    expertise: ['Halacha', 'Mussar', 'Afternoon Seder', 'Practical Applications'],
    videoId: 'dQw4w9WgXcQ',
  },
];

// ── Placeholder Image ─────────────────────────────────────────
function PlaceholderImg({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(' ')
    .filter((w) => w !== 'Rabbi')
    .map((w) => w[0])
    .join('')
    .slice(0, 2);

  return (
    <div
      className={`bg-gradient-to-br from-navy-100 to-obsidian-50 flex items-center justify-center relative overflow-hidden ${className}`}
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(212,175,55,0.15) 20px, rgba(212,175,55,0.15) 21px)',
        }}
      />
      <div className="relative z-10 text-center">
        <div className="w-24 h-24 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center mb-3 mx-auto">
          <span className="text-gold text-3xl font-serif font-bold">{initials}</span>
        </div>
        <p className="text-white/30 text-xs">{name}</p>
      </div>
    </div>
  );
}

// ── Staff Card ────────────────────────────────────────────────
function StaffCard({
  member,
  onClick,
}: {
  member: (typeof staffMembers)[0];
  onClick: () => void;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        onClick={onClick}
        whileHover={{ y: -8, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="glass rounded-2xl overflow-hidden border border-white/5 hover:border-gold/20 cursor-pointer group transition-all duration-500 hover:shadow-[0_20px_60px_rgba(212,175,55,0.1)]"
      >
        {/* Photo */}
        <div className="relative h-72 overflow-hidden">
          <PlaceholderImg name={member.name} className="w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-transparent to-transparent" />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          {/* View Bio badge */}
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <div className="px-3 py-1.5 bg-gold text-obsidian text-xs font-bold rounded-full">
              View Bio
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="p-6">
          <div className="text-gold text-xs font-semibold tracking-widest uppercase mb-2">
            {member.title}
          </div>
          <h3 className="text-white text-xl font-serif font-bold mb-1 group-hover:text-gold transition-colors">
            {member.name}
          </h3>
          <p className="text-white/40 text-sm font-hebrew rtl">{member.hebrewName}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {member.expertise.slice(0, 2).map((e) => (
              <span
                key={e}
                className="px-2.5 py-1 bg-white/5 text-white/50 text-xs rounded-full border border-white/5"
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Full-Screen Modal ─────────────────────────────────────────
// Wrapped in a single <div> (not a fragment) so AnimatePresence can track one root node.
// Rendered via createPortal in the parent to stay outside the grid's React tree,
// which prevents the removeChild reconciliation crash.
function StaffModal({
  member,
  onClose,
}: {
  member: (typeof staffMembers)[0];
  onClose: () => void;
}) {
  return (
    <div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-obsidian/90 backdrop-blur-xl"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 60 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 60 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-4 md:inset-8 lg:inset-16 z-[51] glass rounded-3xl overflow-y-auto border border-white/10"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition-colors"
        >
          ×
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-full">
          {/* Left — Photo & Quick Info */}
          <div className="relative">
            <div className="sticky top-0 h-[50vh] lg:h-full min-h-[400px]">
              <PlaceholderImg name={member.name} className="w-full h-full" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-obsidian/30 lg:bg-gradient-to-t from-obsidian via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 p-8">
                <div className="text-gold text-sm font-semibold tracking-widest uppercase mb-2">
                  {member.title}
                </div>
                <h2 className="text-white text-4xl font-serif font-bold mb-1">
                  {member.name}
                </h2>
                <p className="text-white/40 font-hebrew rtl text-lg">{member.hebrewName}</p>
              </div>
            </div>
          </div>

          {/* Right — Bio & Video */}
          <div className="p-8 lg:p-12 flex flex-col gap-8">
            {/* Expertise */}
            <div>
              <div className="text-gold/50 text-xs tracking-widest uppercase mb-3 font-semibold">
                Areas of Expertise
              </div>
              <div className="flex flex-wrap gap-2">
                {member.expertise.map((e) => (
                  <span
                    key={e}
                    className="px-3 py-1.5 bg-gold/10 border border-gold/20 text-gold text-sm rounded-full"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="divider-gold" />

            {/* Bio */}
            <div>
              <div className="text-gold/50 text-xs tracking-widest uppercase mb-4 font-semibold">
                Biography
              </div>
              <div className="space-y-4">
                {member.bio.split('\n\n').map((para, i) => (
                  <p key={i} className="text-white/70 text-base leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="divider-gold" />

            {/* Video Placeholder */}
            <div>
              <div className="text-gold/50 text-xs tracking-widest uppercase mb-4 font-semibold">
                Featured Shiur
              </div>
              <div className="video-container rounded-xl overflow-hidden border border-white/10">
                <iframe
                  src={`https://www.youtube.com/embed/${member.videoId}?rel=0&modestbranding=1`}
                  title={`${member.name} Shiur`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="text-white/30 text-xs mt-2 text-center">
                Torah Shiur — Yeshiva Ateret Yaakov
              </p>
            </div>

            {/* CTA */}
            <a
              href="https://causematch.com/yay"
              target="_blank"
              rel="noopener noreferrer"
              className="py-4 bg-gold text-obsidian font-bold text-base rounded-xl text-center hover:bg-gold/90 transition-colors hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]"
            >
              Support the Yeshiva in Their Merit
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STAFF PAGE
// ═══════════════════════════════════════════════════════════════
export default function StaffContent() {
  const [mounted, setMounted] = useState(false);
  const [selectedMember, setSelectedMember] = useState<(typeof staffMembers)[0] | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Prevent hydration mismatch — only render animations client-side
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !headerRef.current) return;
    gsap.fromTo(
      headerRef.current.querySelectorAll('.anim-target'),
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.9, stagger: 0.15, ease: 'power3.out', delay: 0.2 }
    );
  }, [mounted]);

  return (
    <div className="min-h-screen bg-obsidian pt-32 pb-24 px-6">
      {/* Header */}
      <div ref={headerRef} className="max-w-7xl mx-auto mb-24 text-center">
        <div className="anim-target text-gold/50 text-xs tracking-[0.3em] uppercase mb-4 font-semibold">
          Leadership & Faculty
        </div>
        <h1 className="anim-target text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-white mb-8 leading-tight">
          The{' '}
          <span className="gold-shimmer">Hanhala</span>
        </h1>
        <p className="anim-target text-white/50 text-xl max-w-2xl mx-auto leading-relaxed font-light">
          Our faculty are not just teachers — they are mentors, role models, and lifelong
          guides who invest themselves fully in every talmid.
        </p>
      </div>

      {/* Staff Grid */}
      <div className="max-w-7xl mx-auto">
        {/* Featured Row — first 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {staffMembers.slice(0, 2).map((member) => (
            <StaffCard
              key={member.id}
              member={member}
              onClick={() => setSelectedMember(member)}
            />
          ))}
        </div>

        {/* Mashgiach — full width-ish */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {staffMembers.slice(2, 3).map((member) => (
            <StaffCard
              key={member.id}
              member={member}
              onClick={() => setSelectedMember(member)}
            />
          ))}
          {/* Quote card */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="glass rounded-2xl p-8 flex flex-col justify-between border border-gold/10 lg:col-span-2"
          >
            <div>
              <div className="text-gold text-5xl font-serif leading-none mb-4">"</div>
              <blockquote className="text-white text-2xl md:text-3xl font-serif font-medium leading-tight mb-6">
                The measure of a yeshiva is not how many students it graduates — it is what
                those students become.
              </blockquote>
              <cite className="text-white/40 text-sm not-italic">
                — Yeshiva Ateret Yaakov
              </cite>
            </div>
            <div className="mt-8">
              <div className="divider-gold mb-6" />
              <div className="flex gap-4 flex-wrap">
                <a
                  href="https://causematch.com/yay"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-gold text-obsidian font-bold text-sm rounded-full hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all"
                >
                  Support Our Mission
                </a>
                <a
                  href="https://www.instagram.com/liffs_yeshiva/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 border border-white/10 text-white/60 text-sm rounded-full hover:border-gold/30 hover:text-white transition-all"
                >
                  Follow @liffs_yeshiva
                </a>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Rest of faculty */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staffMembers.slice(3).map((member) => (
            <StaffCard
              key={member.id}
              member={member}
              onClick={() => setSelectedMember(member)}
            />
          ))}
        </div>
      </div>

      {/* ── Modal rendered into document.body via portal ── */}
      {mounted && createPortal(
        <AnimatePresence>
          {selectedMember && (
            <StaffModal
              member={selectedMember}
              onClose={() => setSelectedMember(null)}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
