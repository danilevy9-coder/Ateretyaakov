'use client';
import React from 'react';
import HeroCanvas from '@/components/HeroCanvas';
import settingsData from '@/data/settings.json';

export default function Home() {
  const data = settingsData as any;
  return (
    <main className="relative min-h-screen bg-[#0a0a0c] overflow-hidden">
      <HeroCanvas youtubeUrl={data.youtubeUrl} />
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4">
        <h1 className="text-6xl md:text-8xl font-bold text-white mb-6">
          Building Torah.<br />Building Life.
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mb-12">
          A yeshiva where every bochur is seen, shaped, and sent forth to lead.
        </p>
      </div>
    </main>
  );
}
