# Yeshiva Ateret Yaakov — Website Setup Guide

## Quick Start

```bash
# 1. Navigate to the project
cd AteretYaakovWebsite

# 2. Install all dependencies
npm install

# 3. Run the development server (on port 3001)
npm run dev
```

Then open: **http://localhost:3001**

---

## Full Dependency Install Command

```bash
npm install next@14.2.5 react@^18.3.1 react-dom@^18.3.1 \
  @react-three/fiber@^8.17.5 @react-three/drei@^9.109.0 three@^0.166.1 \
  gsap@^3.12.5 framer-motion@^11.3.19 lenis@^1.1.13 \
  clsx@^2.1.1 tailwind-merge@^2.4.0

npm install -D \
  typescript@^5.5.3 \
  @types/node@^20.14.11 \
  @types/react@^18.3.3 \
  @types/react-dom@^18.3.0 \
  @types/three@^0.166.0 \
  tailwindcss@^3.4.6 \
  postcss@^8.4.39 \
  autoprefixer@^10.4.19
```

---

## Project Structure

```
AteretYaakovWebsite/
├── app/
│   ├── layout.tsx          — Root layout (Navbar, Lenis, Cursor)
│   ├── page.tsx            — Home page (Hero 3D, GSAP scroll, Bento)
│   ├── globals.css         — Global styles & animations
│   ├── staff/page.tsx      — Hanhala grid + modal
│   ├── gallery/page.tsx    — Masonry gallery + lightbox
│   └── support/page.tsx    — Donation page
├── components/
│   ├── Navbar.tsx          — Fixed glassmorphism navbar
│   ├── CustomCursor.tsx    — Framer Motion custom cursor
│   ├── LenisProvider.tsx   — Smooth scroll (Lenis + GSAP)
│   └── HeroCanvas.tsx      — React Three Fiber particle field
├── public/
│   └── images/
│       ├── logo.png        — Yeshiva logo
│       ├── hero/           — Hero section images
│       ├── staff/          — Rabbi headshots (add your photos here)
│       └── gallery/        — Gallery photos (real photos already here!)
├── package.json
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json
```

---

## Adding Staff Photos

Place Rabbi headshots in `/public/images/staff/` with these exact names:
- `rabbi-yehoshua-liff.jpg`
- `rabbi-dov-ber-liff.jpg`
- `rabbi-larry-shain.jpg`
- `rabbi-avi-cohen.jpg`
- `rabbi-moshe-weiss.jpg`
- `rabbi-nachman-berger.jpg`

---

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Home | `/` | Hero, horizontal scroll, bento grid |
| Hanhala | `/staff` | Staff grid + animated modal bios |
| Gallery | `/gallery` | Masonry + parallax + lightbox |
| Support | `/support` | Donation page (CauseMatch + CharityExtra) |

---

## Donation Links

- **CauseMatch**: https://causematch.com/yay
- **CharityExtra (UK)**: https://www.charityextra.com/ay

---

## Colour Palette

| Name | Hex |
|------|-----|
| Obsidian | `#0a0a0c` |
| Torah Gold | `#D4AF37` |
| Deep Navy | `#0d1b2a` |
| Cream | `#f5f0e8` |
