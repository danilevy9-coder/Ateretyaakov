import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/crm/api-auth';
import { inferMapping, type ImportKind } from '@/lib/crm/ai-mapping';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json()) as {
      kind: ImportKind;
      headers: string[];
      sampleRows: Record<string, unknown>[];
    };
    if (!body.headers?.length) {
      return NextResponse.json({ error: 'No columns found in the file.' }, { status: 400 });
    }
    const result = await inferMapping(body.kind || 'donors', body.headers, body.sampleRows || []);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[import/analyze]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
