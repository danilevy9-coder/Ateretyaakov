'use client';
import React from 'react';
import { motion } from 'framer-motion';
import StaffContent from '@/components/StaffContent';
import settingsData from '@/data/settings.json';

export default function StaffPage() {
  const staff = settingsData.staff || [];
  return (
    <main className="min-h-screen bg-[#0a0a0c] pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-5xl font-bold text-white mb-12 text-center">
          Our <span className="text-[#D4AF37]">Hanhala</span>
        </motion.h1>
        <StaffContent initialStaff={staff} />
      </div>
    </main>
  );
}
