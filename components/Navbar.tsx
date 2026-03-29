'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/staff', label: 'Hanhala' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/support', label: 'Support Us' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Entrance animation
  useEffect(() => {
    if (navRef.current) {
      gsap.fromTo(
        navRef.current,
        { y: -80, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.5 }
      );
    }
  }, []);

  return (
    <>
      <motion.nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? 'glass shadow-[0_4px_30px_rgba(212,175,55,0.08)]' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-gold/30 group-hover:border-gold/60 transition-colors">
              <Image
                src="/images/logo.png"
                alt="Yeshiva Ateret Yaakov"
                fill
                className="object-contain p-1"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-gold font-serif text-sm font-bold">
                AY
              </div>
            </div>
            <div className="hidden sm:block">
              <p className="text-white text-sm font-semibold leading-none tracking-wide">
                Ateret Yaakov
              </p>
              <p className="text-gold/70 text-xs leading-none mt-0.5 rtl font-hebrew">
                עטרת יעקב
              </p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative text-sm font-medium tracking-wide transition-colors hover-underline ${
                  pathname === link.href ? 'text-gold' : 'text-white/70 hover:text-white'
                }`}
              >
                {link.label}
                {pathname === link.href && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute -bottom-1 left-0 right-0 h-px bg-gold"
                  />
                )}
              </Link>
            ))}
            <Link
              href="/support"
              className="px-5 py-2 bg-gold text-obsidian font-semibold text-sm rounded-full hover:bg-gold/90 transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] active:scale-95"
            >
              Donate Now
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col gap-1.5 p-2 group"
            aria-label="Toggle menu"
          >
            <motion.span
              animate={menuOpen ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }}
              className="block w-6 h-px bg-white group-hover:bg-gold transition-colors"
            />
            <motion.span
              animate={menuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
              className="block w-6 h-px bg-white group-hover:bg-gold transition-colors"
            />
            <motion.span
              animate={menuOpen ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }}
              className="block w-6 h-px bg-white group-hover:bg-gold transition-colors"
            />
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-40 glass flex flex-col items-center justify-center gap-8"
          >
            {navLinks.map((link, i) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Link
                  href={link.href}
                  className={`text-3xl font-serif font-bold tracking-wide transition-colors ${
                    pathname === link.href ? 'text-gold' : 'text-white hover:text-gold'
                  }`}
                >
                  {link.label}
                </Link>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: navLinks.length * 0.08 }}
            >
              <Link
                href="/support"
                className="mt-4 px-8 py-3 bg-gold text-obsidian font-bold text-xl rounded-full hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all"
              >
                Donate Now
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
