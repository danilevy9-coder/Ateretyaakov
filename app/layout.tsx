import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import LenisProvider from '@/components/LenisProvider';
import CustomCursor from '@/components/CustomCursor';

export const metadata: Metadata = {
  title: {
    default: 'Yeshiva Ateret Yaakov | Building Torah. Building Life.',
    template: '%s | Yeshiva Ateret Yaakov',
  },
  description:
    'Yeshiva Ateret Yaakov (Liff\'s Yeshiva) — a dynamic, high-energy yeshiva led by Rabbi Yehoshua Liff and Rabbi Dov Ber Liff, dedicated to building Torah excellence and lifelong character.',
  keywords: [
    'Yeshiva Ateret Yaakov',
    'Rabbi Yehoshua Liff',
    'Rabbi Dov Ber Liff',
    "Liff's Yeshiva",
    'Torah',
    'Yeshiva',
    'Jewish Education',
  ],
  openGraph: {
    type: 'website',
    title: 'Yeshiva Ateret Yaakov',
    description: 'Building Torah. Building Life.',
    siteName: 'Yeshiva Ateret Yaakov',
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-obsidian text-white antialiased grain-overlay">
        <LenisProvider>
          <CustomCursor />
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <footer className="border-t border-white/5 py-12 px-6">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <p className="text-gold font-serif text-lg font-semibold">Yeshiva Ateret Yaakov</p>
                <p className="text-white/40 text-sm mt-1">Building Torah. Building Life.</p>
              </div>
              <div className="flex items-center gap-6 text-white/40 text-sm">
                <a
                  href="https://www.instagram.com/liffs_yeshiva/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold transition-colors"
                >
                  Instagram
                </a>
                <a
                  href="https://www.facebook.com/liffsyeshiva/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold transition-colors"
                >
                  Facebook
                </a>
                <a
                  href="https://www.youtube.com/@ישיבתעטרתיעקב"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold transition-colors"
                >
                  YouTube
                </a>
              </div>
              <div className="text-white/30 text-xs">
                © {new Date().getFullYear()} Yeshiva Ateret Yaakov. All rights reserved.
              </div>
            </div>
          </footer>
        </LenisProvider>
      </body>
    </html>
  );
}
