'use client';
import React from 'react';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-6xl md:text-8xl font-bold text-white mb-6">
        Building Torah.<br />Building Life.
      </h1>
      <p className="text-xl text-gray-400 max-w-2xl mb-12">
        A yeshiva where every bochur is seen, shaped, and sent forth to lead.
      </p>
      <div className="flex gap-4">
        <a href="/support" className="bg-[#D4AF37] text-black px-8 py-3 rounded-full font-bold">Support the Yeshiva</a>
        <a href="/staff" className="border border-white text-white px-8 py-3 rounded-full font-bold">Meet the Hanhala</a>
      </div>
    </main>
  );
}
