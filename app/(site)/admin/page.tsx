'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { getPublicId } from '@/lib/imageUrl';

// Env vars set in Vercel dashboard (safe to expose — they're public)
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';

// ── YouTube URL → embed URL ────────────────────────────────────
function toEmbedUrl(url: string): string {
  if (!url) return '';
  if (url.includes('youtube.com/embed/')) return url;
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return `https://www.youtube.com/embed/${short[1]}?rel=0&modestbranding=1`;
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return `https://www.youtube.com/embed/${watch[1]}?rel=0&modestbranding=1`;
  return url;
}

// ── Video settings panel ───────────────────────────────────────
function VideoSettings() {
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [embedPreview, setEmbedPreview] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: { youtubeUrl?: string }) => {
        if (data.youtubeUrl) {
          setUrl(data.youtubeUrl);
          setEmbedPreview(toEmbedUrl(data.youtubeUrl));
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    const embed = toEmbedUrl(url.trim());
    if (url.trim() && !embed.includes('youtube.com/embed/')) {
      setError("Couldn't parse that URL — paste a link like https://www.youtube.com/watch?v=VIDEOID or https://youtu.be/VIDEOID");
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: url.trim() }),
      });
      if (res.ok) {
        setSaved(true);
        setEmbedPreview(embed);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError('Save failed — check the server console.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto mb-10 p-6 bg-red-950/20 border border-red-500/20 rounded-2xl">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">▶️</span>
        <h2 className="text-white font-bold text-lg">YouTube Video (Homepage Bento Grid)</h2>
        <span className="px-2 py-0.5 bg-red-500/20 text-red-300 text-xs rounded-full font-mono">bento</span>
      </div>
      <p className="text-white/50 text-sm mb-5">
        Paste any YouTube link — a single video (<code className="text-green-400 bg-black/30 px-1 rounded">watch?v=…</code>) or a short link (<code className="text-green-400 bg-black/30 px-1 rounded">youtu.be/…</code>). The homepage bento grid will embed it automatically.
      </p>

      <div className="flex gap-3 mb-3">
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="https://www.youtube.com/watch?v=VIDEOID"
          className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-red-400/50 text-sm font-mono"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-red-500 hover:bg-red-400 disabled:bg-red-500/40 text-white font-bold rounded-xl transition-colors whitespace-nowrap text-sm flex items-center gap-2"
        >
          {saving ? (
            <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
          ) : saved ? (
            <>✓ Saved!</>
          ) : (
            <>💾 Save Link</>
          )}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

      {embedPreview && (
        <div className="mt-4">
          <p className="text-white/40 text-xs mb-2">Embed URL (used on homepage):</p>
          <code className="block text-xs bg-black/40 text-green-400 px-3 py-2 rounded-lg font-mono break-all">{embedPreview}</code>
          <div className="mt-4 rounded-xl overflow-hidden border border-white/10" style={{ aspectRatio: '16/9', maxWidth: 480 }}>
            <iframe
              src={embedPreview}
              title="YouTube preview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Password gate ─────────────────────────────────────────────
function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const attempt = () => {
    if (input === 'danilevy9') {
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center px-6">
      <div style={shake ? { animation: 'shake 0.5s ease-in-out' } : {}}>
        <div className="w-full max-w-sm bg-white/3 border border-white/10 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-white text-xl font-bold mb-1">Admin Area</h1>
          <p className="text-white/40 text-sm mb-6">Enter the password to continue</p>
          <input
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            onKeyDown={(e) => e.key === 'Enter' && attempt()}
            placeholder="Password"
            autoFocus
            className={`w-full px-4 py-3 rounded-xl bg-black/40 border text-white placeholder:text-white/20 focus:outline-none text-center text-lg tracking-widest mb-4 transition-colors ${
              error ? 'border-red-500/60 text-red-400' : 'border-white/10 focus:border-amber-500/50'
            }`}
          />
          {error && <p className="text-red-400 text-xs mb-3">Incorrect password. Try again.</p>}
          <button
            onClick={attempt}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-colors"
          >
            Unlock →
          </button>
        </div>
      </div>
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          15%{transform:translateX(-8px)}
          30%{transform:translateX(8px)}
          45%{transform:translateX(-6px)}
          60%{transform:translateX(6px)}
          75%{transform:translateX(-3px)}
          90%{transform:translateX(3px)}
        }
      `}</style>
    </div>
  );
}

// ── All image slots ───────────────────────────────────────────
const imageSlots = [
  {
    section: '🏠 Home — Hero Background',
    color: 'from-blue-900/30 to-blue-950/30',
    border: 'border-blue-500/20',
    badge: 'bg-blue-500/20 text-blue-300',
    slots: [
      { path: '/images/hero/beis-medrash.png', label: 'Hero Background', hint: 'Wide landscape photo. Best: 1920×1080px.', used: ['Hero section background'] },
      { path: '/images/hero/bochurim.png', label: 'Hero — Bochurim', hint: 'Group of bochurim. Wide shot.', used: ['Hero section'] },
    ],
  },
  {
    section: '📜 Home — Horizontal Scroll',
    color: 'from-purple-900/30 to-purple-950/30',
    border: 'border-purple-500/20',
    badge: 'bg-purple-500/20 text-purple-300',
    slots: [
      { path: '/images/gallery/beis-medrash-1.jpg', label: 'Beis Medrash #1', hint: 'Portrait or landscape.', used: ['Home scroll card 1'] },
      { path: '/images/gallery/shiur-1.jpg', label: 'Shiur in Session', hint: 'Rabbi giving a shiur.', used: ['Home scroll card 2'] },
      { path: '/images/gallery/bochurim-1.jpg', label: 'Bochurim Together', hint: 'Group shot.', used: ['Home scroll card 3'] },
      { path: '/images/gallery/shabbos-1.jpg', label: 'Shabbos', hint: 'Shabbos table or davening.', used: ['Home scroll card 4'] },
      { path: '/images/gallery/rabbi-liff-teaching.jpg', label: 'Rabbi Liff Teaching', hint: 'Action shot teaching.', used: ['Home scroll card 5'] },
      { path: '/images/gallery/bochurim-2.jpg', label: 'Brotherhood', hint: 'Candid bochurim photo.', used: ['Home scroll card 6'] },
    ],
  },
  {
    section: '👨‍🏫 Staff / Hanhala',
    color: 'from-amber-900/30 to-amber-950/30',
    border: 'border-amber-500/20',
    badge: 'bg-amber-500/20 text-amber-300',
    slots: [
      { path: '/images/staff/rabbi-yehoshua-liff.jpg', label: 'Rabbi Yehoshua Liff', hint: 'Headshot. Square or portrait.', used: ['Staff card', 'Home preview', 'Modal'] },
      { path: '/images/staff/rabbi-dov-ber-liff.jpg', label: 'Rabbi Dov Ber Liff', hint: 'Headshot. Square or portrait.', used: ['Staff card', 'Home preview', 'Modal'] },
      { path: '/images/staff/rabbi-larry-shain.jpg', label: 'Rabbi Larry Shain', hint: 'Headshot. Square or portrait.', used: ['Staff card', 'Home preview', 'Modal'] },
      { path: '/images/staff/rabbi-avi-cohen.jpg', label: 'Rabbi Avi Cohen', hint: 'Headshot.', used: ['Staff card'] },
      { path: '/images/staff/rabbi-moshe-weiss.jpg', label: 'Rabbi Moshe Weiss', hint: 'Headshot.', used: ['Staff card'] },
      { path: '/images/staff/rabbi-nachman-berger.jpg', label: 'Rabbi Nachman Berger', hint: 'Headshot.', used: ['Staff card'] },
    ],
  },
  {
    section: '🖼️ Gallery Page',
    color: 'from-green-900/30 to-green-950/30',
    border: 'border-green-500/20',
    badge: 'bg-green-500/20 text-green-300',
    slots: Array.from({ length: 16 }, (_, i) => ({
      path: `/images/gallery/photo-${i + 1}.png`,
      label: `Gallery Photo ${i + 1}`,
      hint: 'Mix portrait + landscape for best masonry effect.',
      used: ['Gallery page'],
    })),
  },
  {
    section: '🏷️ Logo',
    color: 'from-yellow-900/30 to-yellow-950/30',
    border: 'border-yellow-500/20',
    badge: 'bg-yellow-500/20 text-yellow-300',
    slots: [
      { path: '/images/logo.png', label: 'Main Logo', hint: 'PNG with transparent background. Used in navbar.', used: ['Navbar', 'Footer'] },
    ],
  },
];

// ── Slot card with upload ─────────────────────────────────────
function SlotCard({ slot }: { slot: { path: string; label: string; hint: string; used: string[] } }) {
  const [imgKey, setImgKey] = useState(0);
  const [exists, setExists] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadOk, setUploadOk] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  // After a successful Cloudinary upload, switch the preview to the returned URL
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const apiPath = slot.path.replace(/^\//, '');
  const publicId = getPublicId(slot.path);

  // Derive the current Cloudinary URL for this slot (if cloud is configured)
  const cloudinarySrc = CLOUD_NAME
    ? `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto/${publicId}`
    : null;

  // The image we actually show: prefer liveUrl (just uploaded) → cloudinary → local path
  const previewSrc = liveUrl ?? cloudinarySrc ?? slot.path;

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadOk(false);
    setUploadErr('');
    try {
      if (CLOUD_NAME && UPLOAD_PRESET) {
        // ── Cloudinary direct upload (works on Vercel) ──
        const form = new FormData();
        form.append('file', file);
        form.append('upload_preset', UPLOAD_PRESET);
        form.append('public_id', publicId);
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          { method: 'POST', body: form }
        );
        const data = await res.json() as { secure_url?: string; error?: { message: string } };
        if (data.secure_url) {
          setLiveUrl(data.secure_url + '?bust=' + Date.now());
          setUploadOk(true);
          setExists(true);
          setTimeout(() => setUploadOk(false), 4000);
        } else {
          setUploadErr(data.error?.message ?? 'Cloudinary upload failed');
        }
      } else {
        // ── Fallback: local server upload (dev mode only) ──
        const form = new FormData();
        form.append('file', file);
        form.append('path', apiPath);
        const res = await fetch('/api/upload', { method: 'POST', body: form });
        if (res.ok) {
          setUploadOk(true);
          setExists(true);
          setImgKey((k) => k + 1);
          setTimeout(() => setUploadOk(false), 3000);
        } else {
          setUploadErr('Server upload failed');
        }
      }
    } catch (e) {
      setUploadErr(String(e));
    } finally {
      setUploading(false);
    }
  }, [apiPath, publicId]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  const copyPath = () => {
    navigator.clipboard.writeText(`public${slot.path}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`bg-white/3 border rounded-xl overflow-hidden transition-all ${
        dragOver ? 'border-amber-400/60 bg-amber-400/5 scale-[1.02]' : 'border-white/8 hover:border-white/15'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {/* Image preview */}
      <div className="relative h-44 bg-black/30 flex items-center justify-center overflow-hidden">
        <Image
          key={imgKey + (liveUrl ?? cloudinarySrc ?? '')}
          src={previewSrc}
          alt={slot.label}
          fill
          className="object-cover"
          onLoad={() => setExists(true)}
          onError={() => setExists(false)}
          unoptimized
        />

        {/* Status badge */}
        <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold z-10 ${
          uploadOk ? 'bg-green-400 text-black' :
          exists === true ? 'bg-green-500/90 text-white' :
          exists === false ? 'bg-red-500/80 text-white' :
          'bg-white/10 text-white/40'
        }`}>
          {uploadOk ? '✓ Uploaded!' : exists === true ? '✓ Image found' : exists === false ? '✗ Missing' : '…'}
        </div>

        {/* Drag hint overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-amber-400/10 border-2 border-dashed border-amber-400/60">
            <div className="text-3xl mb-1">📥</div>
            <p className="text-amber-300 text-xs font-bold">Drop to upload</p>
          </div>
        )}

        {/* Placeholder */}
        {exists === false && !dragOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-0 pointer-events-none">
            <div className="text-white/10 text-4xl">🖼️</div>
          </div>
        )}

        {/* Uploading spinner */}
        {uploading && (
          <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Info + actions */}
      <div className="p-4">
        <p className="text-white font-semibold text-sm mb-1">{slot.label}</p>
        <p className="text-white/40 text-xs mb-3 leading-relaxed">{slot.hint}</p>

        {/* Upload button */}
        <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full py-2.5 mb-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-black font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {uploading ? (
            <><div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" /> Uploading…</>
          ) : (
            <>📤 Upload Image</>
          )}
        </button>

        {/* Upload error */}
        {uploadErr && <p className="text-red-400 text-xs mb-2">{uploadErr}</p>}

        {/* Drag hint */}
        <p className="text-white/25 text-xs text-center mb-3">or drag & drop a photo onto this card</p>

        {/* Cloudinary public_id (shown when Cloudinary is configured) */}
        {CLOUD_NAME ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-black/40 text-sky-400 px-2 py-1.5 rounded font-mono truncate" title="Cloudinary public_id">
              ☁ {publicId}
            </code>
            <button onClick={copyPath} className="px-2 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs rounded transition-all whitespace-nowrap">
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-black/40 text-green-400 px-2 py-1.5 rounded font-mono truncate">
              public{slot.path}
            </code>
            <button onClick={copyPath} className="px-2 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs rounded transition-all whitespace-nowrap">
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        )}

        {/* Used in */}
        <div className="flex flex-wrap gap-1 mt-2">
          {slot.used.map((u) => (
            <span key={u} className="px-1.5 py-0.5 bg-white/5 text-white/25 text-xs rounded">{u}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADMIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  const totalSlots = imageSlots.flatMap((s) => s.slots).length;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white pt-24 pb-24 px-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🖼️</span>
          <h1 className="text-3xl font-bold text-white">Image Manager</h1>
          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded-full font-mono">/admin</span>
        </div>
        <p className="text-white/50 text-sm max-w-2xl mb-6">
          Click <strong className="text-amber-400">Upload Image</strong> on any card — or drag & drop a photo directly onto it. The site updates instantly.
        </p>

        {/* Cloudinary status banner */}
        {CLOUD_NAME ? (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl mb-4 flex items-center gap-3">
            <span className="text-green-400 text-xl">☁</span>
            <div>
              <p className="text-green-300 font-semibold text-sm">Cloudinary connected — uploads go straight to the cloud ✓</p>
              <p className="text-green-300/50 text-xs mt-0.5">Cloud: <code className="text-green-400">{CLOUD_NAME}</code> · Images are permanent on Vercel</p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl mb-4">
            <p className="text-orange-300 font-semibold text-sm mb-2">⚠ Cloudinary not configured — uploads only work locally (not on Vercel)</p>
            <p className="text-orange-200/60 text-xs mb-3">Add these 2 env vars in your <strong className="text-orange-300">Vercel dashboard → Settings → Environment Variables</strong>, then redeploy:</p>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="bg-black/40 rounded px-3 py-2 text-white/70">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = <span className="text-amber-400">your-cloud-name</span></div>
              <div className="bg-black/40 rounded px-3 py-2 text-white/70">NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET = <span className="text-amber-400">your-unsigned-preset</span></div>
            </div>
            <p className="text-orange-200/50 text-xs mt-3">Free at <a href="https://cloudinary.com" target="_blank" rel="noopener" className="text-orange-300 underline">cloudinary.com</a> — create an account → Settings → Upload → &quot;Add upload preset&quot; → set Signing mode to <strong>Unsigned</strong></p>
          </div>
        )}

        {/* How-to */}
        <div className="p-5 bg-blue-500/8 border border-blue-500/20 rounded-xl mb-4">
          <h2 className="text-blue-300 font-semibold text-sm mb-3">📋 How to add photos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-white/60">
            <div className="flex gap-3 items-start">
              <span className="text-blue-400 font-bold text-lg leading-none">1</span>
              <p>Find the image slot below (e.g. "Rabbi Yehoshua Liff")</p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-blue-400 font-bold text-lg leading-none">2</span>
              <p>Click <span className="text-amber-400 font-semibold">Upload Image</span> and pick your photo — or drag & drop it</p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-blue-400 font-bold text-lg leading-none">3</span>
              <p>Done! The badge turns <span className="text-green-400 font-semibold">green</span> and the photo goes live</p>
            </div>
          </div>
        </div>

        <div className="px-3 py-1.5 bg-white/5 rounded-lg text-sm inline-block">
          <span className="text-white/40">Total slots: </span>
          <span className="text-white font-bold">{totalSlots}</span>
        </div>
      </div>

      {/* Video Settings */}
      <VideoSettings />

      {/* Section filter */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveSection(null)}
          className={`px-4 py-2 rounded-full text-sm transition-all ${activeSection === null ? 'bg-white text-black font-semibold' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
        >
          All
        </button>
        {imageSlots.map((s) => (
          <button
            key={s.section}
            onClick={() => setActiveSection(s.section === activeSection ? null : s.section)}
            className={`px-4 py-2 rounded-full text-sm transition-all ${activeSection === s.section ? 'bg-white text-black font-semibold' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
          >
            {s.section}
          </button>
        ))}
      </div>

      {/* Sections */}
      <div className="max-w-6xl mx-auto space-y-12">
        {imageSlots
          .filter((s) => activeSection === null || s.section === activeSection)
          .map((section) => (
            <div key={section.section}>
              <div className={`flex items-center gap-3 mb-5 p-4 rounded-xl bg-gradient-to-r ${section.color} border ${section.border}`}>
                <h2 className="text-white font-bold text-lg">{section.section}</h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${section.badge}`}>
                  {section.slots.length} image{section.slots.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {section.slots.map((slot) => (
                  <SlotCard key={slot.path} slot={slot} />
                ))}
              </div>
            </div>
          ))}
      </div>

      <div className="max-w-6xl mx-auto mt-16 p-4 bg-white/3 border border-white/8 rounded-xl text-center">
        <p className="text-white/30 text-sm">
          This page only works in dev mode.{' '}
          <a href="/" className="text-amber-400 hover:underline">← Back to site</a>
        </p>
      </div>
    </div>
  );
}
