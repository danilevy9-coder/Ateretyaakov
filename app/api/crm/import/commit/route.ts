import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/crm/api-auth';
import { commitImport, type CommitParams } from '@/lib/crm/import';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json()) as Omit<CommitParams, 'createdBy'>;
    if (!body.rows?.length) {
      return NextResponse.json({ error: 'No rows to import.' }, { status: 400 });
    }
    const result = await commitImport({ ...body, createdBy: user.email ?? user.id });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[import/commit]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
