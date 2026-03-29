import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'settings.json');

interface Settings {
  youtubeUrl?: string;
}

async function readSettings(): Promise<Settings> {
  try {
    const raw = await readFile(SETTINGS_PATH, 'utf-8');
    return JSON.parse(raw) as Settings;
  } catch {
    return {};
  }
}

async function writeSettings(settings: Settings): Promise<void> {
  await mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

export async function GET() {
  const settings = await readSettings();
  return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<Settings>;
    const existing = await readSettings();
    const merged: Settings = { ...existing, ...body };
    await writeSettings(merged);
    return NextResponse.json({ success: true, settings: merged });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to save settings', detail: String(err) }, { status: 500 });
  }
}
