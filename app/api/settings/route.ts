import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * Settings storage — auto-selects the right backend:
 *
 * • Upstash Redis (production / Vercel)
 *   Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in Vercel env vars.
 *
 * • Local JSON file (dev fallback when Upstash vars are absent)
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY = 'ay-settings'; // no colon — avoids URL routing edge cases

interface Settings {
  youtubeUrl?: string;
  [key: string]: unknown;
}

// ── Upstash Redis helpers (command array format) ─────────────────────
async function redisGet(): Promise<Settings> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return {};
  try {
    const res = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['GET', REDIS_KEY]),
      cache: 'no-store',
    });
    const json = await res.json() as { result: string | null; error?: string };
    if (json.error) throw new Error(json.error);
    return json.result ? (JSON.parse(json.result) as Settings) : {};
  } catch (e) {
    console.error('[settings] Upstash GET error:', e);
    return {};
  }
}

async function redisSet(settings: Settings): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['SET', REDIS_KEY, JSON.stringify(settings)]),
  });
  const json = await res.json() as { result: string; error?: string };
  if (json.error) throw new Error(json.error);
}

// ── Local JSON file helpers (dev only) ──────────────────────────────
const LOCAL_PATH = path.join(process.cwd(), 'data', 'settings.json');

async function localRead(): Promise<Settings> {
  try {
    const raw = await readFile(LOCAL_PATH, 'utf-8');
    return JSON.parse(raw) as Settings;
  } catch {
    return {};
  }
}

async function localWrite(settings: Settings): Promise<void> {
  await mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await writeFile(LOCAL_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

// ── Route handlers ───────────────────────────────────────────────────
export async function GET() {
  try {
    const settings = UPSTASH_URL ? await redisGet() : await localRead();
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<Settings>;
    const existing = UPSTASH_URL ? await redisGet() : await localRead();
    const merged: Settings = { ...existing, ...body };

    if (UPSTASH_URL) {
      await redisSet(merged);
    } else {
      await localWrite(merged);
    }

    return NextResponse.json({ success: true, settings: merged });
  } catch (err) {
    console.error('[settings] POST error:', err);
    return NextResponse.json(
      { error: 'Failed to save settings', detail: String(err) },
      { status: 500 }
    );
  }
}
