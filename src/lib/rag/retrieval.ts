import { getRagConfig } from './config';
import { getPool, toVectorLiteral } from './db';
import { embedText } from './embeddings';
import type { RetrievedChunk } from './types';

interface ChunkRow {
  url: string;
  title: string | null;
  content: string;
  chunk_index: number;
  metadata: Record<string, unknown> | null;
  score: number | string;
}

export async function retrieveRelevantChunks(
  query: string,
  topK?: number,
): Promise<RetrievedChunk[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error('Query must not be empty.');
  }

  const config = getRagConfig();
  const limit = Math.min(Math.max(topK ?? config.topK, 1), 50);
  const embedding = await embedText(trimmedQuery);

  const result = await getPool().query(
    `SELECT d.url,
            d.title,
            c.content,
            c.chunk_index,
            c.metadata,
            1 - (c.embedding <=> $1::vector) AS score
       FROM rag_chunks c
       JOIN rag_documents d ON d.id = c.document_id
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2`,
    [toVectorLiteral(embedding), limit],
  );

  return (result.rows as ChunkRow[]).map((row) => ({
    url: row.url,
    title: row.title ?? row.url,
    content: row.content,
    score: Number(row.score),
    chunkIndex: row.chunk_index,
    metadata: row.metadata ?? {},
  }));
}
