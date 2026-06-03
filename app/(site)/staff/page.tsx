import dynamic from 'next/dynamic';

// Disable server-side rendering entirely for this page.
// The animation libraries (Framer Motion + GSAP) cause a React hydration
// mismatch when server-rendered, which produces the removeChild crash.
const StaffContent = dynamic(() => import('@/components/StaffContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
        <p className="text-white/40 text-sm">Loading Hanhala…</p>
      </div>
    </div>
  ),
});

export default function StaffPage() {
  return <StaffContent />;
}
