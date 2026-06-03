import type { Metadata } from 'next';
import './globals.css';

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
      <body className="bg-obsidian text-white antialiased">{children}</body>
    </html>
  );
}
