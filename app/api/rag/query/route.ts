import { NextResponse } from 'next/server';
import { retrieveRelevantChunks } from '@/src/lib/rag/retrieval';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface QueryBody {
  query: string;
  topK?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseQueryBody(value: unknown): QueryBody | null {
  if (!isRecord(value) || typeof value.query !== 'string' || value.query.trim().length === 0) {
    return null;
  }

  const topK =
    typeof value.topK === 'number' && Number.isFinite(value.topK)
      ? Math.trunc(value.topK)
      : undefined;

  return { query: value.query.trim(), topK };
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const body = parseQueryBody(payload);
  if (!body) {
    return NextResponse.json(
      { error: 'Provide a non-empty "query" string.' },
      { status: 400 },
    );
  }

  try {
    const results = await retrieveRelevantChunks(body.query, body.topK);
    return NextResponse.json({ query: body.query, results });
  } catch (error) {
    console.error('[rag] query failed', error);
    return NextResponse.json({ error: 'Knowledge search is unavailable.' }, { status: 503 });
  }
}
