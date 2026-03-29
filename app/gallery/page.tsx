'use client';
import React from 'react';
import { motion } from 'framer-motion';

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] pt-32 pb-12 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl font-bold text-white mb-12 text-center"
        >
          Life at <span className="text-[#D4AF37]">Ateret Yaakov</span>
        </motion.h1>
        
        {/* If your gallery images are in public/images/gallery, they will show here */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <p className="text-gray-500 col-span-full text-center italic">
            Connecting to image library...
          </p>
        </div>
      </div>
    </main>
  );
}
