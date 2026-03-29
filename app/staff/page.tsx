'use client';
import React from 'react';
import StaffContent from '@/components/StaffContent';
import settingsData from '@/data/settings.json';

export default function StaffPage() {
  const data = settingsData as any;
  const staff = data.staff || [];
  return (
    <main className="min-h-screen bg-[#0a0a0c] pt-32 pb-12 px-4">
      <h1 className="text-5xl font-bold text-white mb-12 text-center">Our Hanhala</h1>
      <StaffContent initialStaff={staff} />
    </main>
  );
}
