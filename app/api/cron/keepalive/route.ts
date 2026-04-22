import { NextResponse } from 'next/server';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export async function GET() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return NextResponse.json({ ok: false, reason: 'Upstash not configured' }, { status: 500 });
  }

  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['PING']),
  });

  const json = await res.json();
  return NextResponse.json({ ok: true, ping: json.result });
}
